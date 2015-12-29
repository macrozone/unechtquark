
Router.configure({
	layoutTemplate: 'layout'
});
if(Meteor.isServer)
	Players = new Meteor.Collection("Players",{connection:null});
else
	Players = new Meteor.Collection("Players");

Players.helpers({
	isMe(){
		return this.userId === Meteor.userId();
	},
	currentRoom() {
		return Rooms.findOne(this.roomId);
	},
	positionV3() {
		return new THREE.Vector3(this.x, this.y, this.z);
	},
	directionV3() {
		return new THREE.Vector3(this.lookX, this.lookY, this.lookZ);
	}
});
Rooms = new Meteor.Collection("Rooms");

RoomEngines = new Map;
Rooms.helpers({
	players() {
		return Players.find({roomId: this._id});
	},
	me(){
		return Players.findOne({roomId: this._id, userId: Meteor.userId()});
	},
	others(userId = Meteor.userId()){
		return Players.find({roomId: this._id, userId: {$ne: userId}});
	},
	engine(){
		if(! RoomEngines.has(this._id)) {
			RoomEngines.set(this._id, new RoomEngine(this._id));
		}
		return RoomEngines.get(this._id);
	},
	killEngine(){
		this.engine().stop();
		RoomEngines.delete(this._id);
	}
});
if(Meteor.isServer) {
	Meteor.publish("Rooms.list", function(){
		return Rooms.find();
	});
	Meteor.publishComposite("Rooms.join", function(roomId) {
		let room = Rooms.findOne(roomId);
		console.log(`joining room ${roomId}`)
		room.engine().start();
		this.onStop(()=> {
			console.log(`leaving room ${roomId}`)
			Players.remove({userId: this.userId});
			if(Players.find({roomId}).count() === 0) {
				room.engine().stop();
				room.killEngine();
			}
		});
		if(room) {
			let x = Math.random()*100-50;
			let z = Math.random()*100-50;
			Players.insert({roomId, userId: this.userId, x:x,y:1,z:z, kills: [], killedBy: []});

		}


		return {
			find(){
				return Rooms.find({_id: roomId});
			},
			children: [
			{
				find(room){
					return Players.find({roomId:room._id});
				}
			}
			]
		}
	});

}



Meteor.methods({
	["Rooms.create"](){
		return Rooms.insert({});
	}
})




Router.route("/room/:_id", {
	name: "room",
	waitOn() {
		return Meteor.subscribe("Rooms.join", this.params._id)
	},
	data() {
		return {
			room: Rooms.findOne(this.params._id)
		}
	}
});


Router.route("/", {
	template: "rooms"
});




if(Meteor.isClient) {

	$(window).on("resize", function(){
		Session.set("window.resize", new Date());
	});

	Template.rooms.onCreated(function(){
		this.subscribe("Rooms.list");
	});
	Template.rooms.helpers({
		rooms() {
			return Rooms.find();
		}
	});
	Template.rooms.events({
		['click .btn-create-room'](){
			Meteor.call("Rooms.create", function(error, _id){
				Router.go("room", {_id});
			});
		}
	});



	Template.room_scene.onRendered(function(){
		this.playerLookDirectionX = new ReactiveVar(0);
		this.playerLookDirectionY = new ReactiveVar(0);
		this.playerLookDirectionZ = new ReactiveVar(0);
		let engine = this.data.room.engine();
		let scene = engine.scene;


		let raycaster = new THREE.Raycaster();
		let mouse = new THREE.Vector2();
		let $container = this.$(".canvas-container");

		let renderer = new THREE.WebGLRenderer({antialias:true});

		let camera = new THREE.PerspectiveCamera(75, $container.width()/$container.height(), 0.1, 10000);
		let controls = new THREE.PointerLockControls( camera);
		controls.enabled = true;
		window.controls = controls;
		engine.setClient({camera, controls});
		

		renderer.setClearColor( 0xffffff, 1 );
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize($container.width(), $container.height());
		$container.append(renderer.domElement);

		scene.add(new THREE.AmbientLight(0x505050));
		let light = new THREE.SpotLight(0xffffff, 1.5);
		light.position.set(0,0,5);
		light.castShadow = true;
		scene.add(light);
		let texture = THREE.ImageUtils.loadTexture( "/texture.jpg" );

		// assuming you want the texture to repeat in both directions:
		texture.wrapS = THREE.RepeatWrapping; 
		texture.wrapT = THREE.RepeatWrapping;

		// how many times to repeat in each direction; the default is (1,1),
		//   which is probably why your example wasn't working
		texture.repeat.set( 200,200 ); 

		let material = new THREE.MeshLambertMaterial({ map : texture });
		var geometry = new THREE.PlaneGeometry( 500, 500, 32 );

		var floor = new THREE.Mesh( geometry, material );
		scene.add( floor );

		floor.rotation.x = -Math.PI/2;


		window.camera = camera;

		this.autorun(() => {
			// update size on window resize
			Session.get("window.resize");
			let width = $container.width();
			let height = $container.height();
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width,height);
		});



		this.autorun(() => {
			Meteor.call("Player.forward", Keypress.is(Keypress.Keys.e))}
			);
		this.autorun(() => {if(Keypress.is(Keypress.Keys.x)) Meteor.call("Player.shoot")});
		this.autorun(() => Meteor.call("Player.backward", Keypress.is(Keypress.Keys.d)));
		this.autorun(() => Meteor.call("Player.left", Keypress.is(Keypress.Keys.s)));
		this.autorun(() => Meteor.call("Player.right", Keypress.is(Keypress.Keys.f)));
		this.autorun(() => Meteor.call("Player.lookX", this.playerLookDirectionX.get()));
		this.autorun(() => Meteor.call("Player.lookY", this.playerLookDirectionY.get()));
		this.autorun(() => Meteor.call("Player.lookZ", this.playerLookDirectionZ.get()));

		
		// handle player camera

		let lookDirectionVector = new THREE.Vector3;
		let cameraHandle = Meteor.setInterval(() => {
			controls.getDirection(lookDirectionVector);
			this.playerLookDirectionX.set(lookDirectionVector.x);
			this.playerLookDirectionY.set(lookDirectionVector.y);
			this.playerLookDirectionZ.set(lookDirectionVector.z);
		},50);

		this.view.onViewDestroyed(function(){
			Meteor.clearInterval(cameraHandle)
		});

		engine.start();
		

		this.view.onViewDestroyed(function(){
			engine.stop();
		});

		// main render loop

		render = (time) => {
			if(!this.view.isDestroyed) {
				requestAnimationFrame(render);
				renderer.render(scene, camera);
				
				
				TWEEN.update(time);
			}
		}
		render();

	});	


	Template.room_scene.events({
		["click"](event, template){
			template.$(".canvas-container").get(0).requestPointerLock();
			Meteor.call("Player.shoot");
		}
	})

	Template.room_raking.helpers({
		ranking() {
			return _.sortBy(this.room.players().fetch(), (player) => -player.kills.length);
		}
	});



}