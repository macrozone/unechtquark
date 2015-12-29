
Router.configure({
	layoutTemplate: 'layout'
});

Players = new Meteor.Collection("Players");

Players.helpers({
	isMe(){
		return this.userId === Meteor.userId();
	},
	currentRoom() {
		return Rooms.findOne(this.roomId);
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
	others(){
		return Players.find({roomId: this._id, userId: {$ne: Meteor.userId()}});
	},
	engine(){
		if(! RoomEngines.has(this._id)) {
			RoomEngines.set(this._id, new RoomEngine(this._id));
		}
		return RoomEngines.get(this._id);
	},
	killEngine(){
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
			}
		});
		if(room) {
			Players.insert({roomId, userId: this.userId, x:0,y:0,z:0});

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


let walkDelta = 0.1;


Meteor.methods({
	["Player.forward"](forward) {

		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {forward}});
	},
	["Player.backward"](backward) {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {backward}});
	},
	["Player.left"](left) {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {left}});
	},
	["Player.right"](right) {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {right}});
	},
	["Player.lookX"](lookX) {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {lookX}});
	},
	["Player.lookY"](lookY) {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {lookY}});
	},
	["Player.lookZ"](lookZ) {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {lookZ}});
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
		let scene = new THREE.Scene();
		let raycaster = new THREE.Raycaster();
		let mouse = new THREE.Vector2();
		let $container = this.$(".canvas-container");

		let renderer = new THREE.WebGLRenderer({antialias:true});

		let camera = new THREE.PerspectiveCamera(75, $container.width()/$container.height(), 0.1, 10000);
		let controls = new THREE.PointerLockControls( camera);
		window.controls = controls;
		controls.enabled = true;
		scene.add(controls.getObject());

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



		this.autorun(() => Meteor.call("Player.forward", Keypress.is(Keypress.Keys.e)));
		this.autorun(() => Meteor.call("Player.backward", Keypress.is(Keypress.Keys.d)));
		this.autorun(() => Meteor.call("Player.left", Keypress.is(Keypress.Keys.s)));
		this.autorun(() => Meteor.call("Player.right", Keypress.is(Keypress.Keys.f)));
		this.autorun(() => Meteor.call("Player.lookX", this.playerLookDirectionX.get()));
		this.autorun(() => Meteor.call("Player.lookY", this.playerLookDirectionY.get()));
		this.autorun(() => Meteor.call("Player.lookZ", this.playerLookDirectionZ.get()));

		let sceneObjects = new Map;
		function setPositionFields(position, fields) {
			let pos = {};
			if(_.has(fields, "x")) {
				pos.x = fields.x;
			}
			if(_.has(fields, "y")) {
				pos.y = fields.y;
			}
			if(_.has(fields, "z")) {
				pos.z = fields.z;
			}

			let tween = new TWEEN.Tween(position);
			tween.to(pos, 100);
			//tween.easing(TWEEN.Easing.Linear);
			tween.start()
		}
		let yAxis = new THREE.Vector3(0,1,0);
		function setRotationFields(rotation, fields) {
			let pos = {};
			
			if(_.has(fields, "lookX")) {
				pos.x = fields.lookX;
			}
			if(_.has(fields, "lookZ")) {
				pos.y = fields.lookZ;
			}
			console.log(pos);
			let tween = new TWEEN.Tween(rotation);
			tween.to(pos, 100);
			//tween.easing(TWEEN.Easing.Linear);
			tween.start()
		}

		// handle player

		this.autorun(() => {
			let {x,y,z} = this.data.room.me();
			setPositionFields(controls.getObject().position,{x,y:y+1,z});
		});
		let lookDirectionVector = new THREE.Vector3;
		let cameraHandle = Meteor.setInterval(() => {
			controls.getDirection(lookDirectionVector);
			this.playerLookDirectionX.set(lookDirectionVector.x);
			this.playerLookDirectionY.set(lookDirectionVector.y);
			this.playerLookDirectionZ.set(lookDirectionVector.z);
		},100)
		this.view.onViewDestroyed(function(){
			Meteor.clearInterval(cameraHandle)
		});

		// handle others
		let handle = this.data.room.others().observeChanges({
			added(id, fields) {
				let player = ThreeObjectFactory.createPlayer();
				setPositionFields(player.position, fields);
				setRotationFields(player.rotation, fields);
				
				scene.add(player);
				sceneObjects.set(id, player);
			},
			changed(id, fields) {
				let player = sceneObjects.get(id);

				setPositionFields(player.position, fields);
				setRotationFields(player.rotation, fields);

			},

			removed(id) {
				console.log("removed", id);
				let player = sceneObjects.get(id);
				scene.remove(player);
				sceneObjects.delete(id);
			}
		});

		this.view.onViewDestroyed(function(){
			handle.stop();
		});

		// main render loop

		render = (time) => {
			if(!this.view.isDestroyed) {
				requestAnimationFrame(render);
				renderer.render(scene, camera);
				raycaster.setFromCamera(mouse, camera);
				
				TWEEN.update(time);
			}
		}
		render();

	});	


Template.room_scene.events({
	["click"](event, template){
		template.$(".canvas-container").get(0).requestPointerLock();
	}
})



ThreeObjectFactory = {
	createPlayer() {

		var geometry = new THREE.BoxGeometry( 1, 1, 1);
		return new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: 0xff0000 } ) ) ;



	}
}
}