
Router.configure({
  layoutTemplate: 'layout'
});
if(Meteor.isServer)
	Players = new Meteor.Collection("Players", {connection: null}); // in memory
if(Meteor.isClient)
	Players = new Meteor.Collection("Players");

Rooms = new Meteor.Collection("Rooms");
Rooms.helpers({
	players() {
		return Players.find({roomId: this._id});
	},
	me(){
		return Players.findOne({roomId: this._id, userId: Meteor.userId()});
	},
	others(){
		return Players.find({roomId: this._id, userId: {$ne: Meteor.userId()}});
	}
});
if(Meteor.isServer) {
	Meteor.publish("Rooms.list", function(){
		return Rooms.find();
	});
	Meteor.publishComposite("Rooms.join", function(roomId) {
		let room = Rooms.findOne(roomId);
		console.log(`joining room ${roomId}`)
		this.onStop(()=> {
			console.log(`leaving room ${roomId}`)
			Players.remove({userId: this.userId});
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


let walkDelta = 10
Meteor.methods({
	["Player.walk"]() {
		let player = Players.findOne({userId:this.userId});
		Players.update({_id: player._id}, {$set: {x: player.x+walkDelta}});


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
		let scene = new THREE.Scene();
		let raycaster = new THREE.Raycaster();
		let mouse = new THREE.Vector2();
		let $container = this.$(".canvas-container");
		let renderer = new THREE.WebGLRenderer({antialias:true});

		let camera = new THREE.PerspectiveCamera(75, $container.width()/$container.height(), 0.1, 10000);
		let controls = new THREE.OrbitControls(camera, renderer.domElement);

		renderer.setClearColor( 0xffffff, 1 );
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize($container.width(), $container.height());
		$container.append(renderer.domElement);

		scene.add(new THREE.AmbientLight(0x505050));
		let light = new THREE.SpotLight(0xffffff, 1.5);
		light.position.set(100,500,200);
		light.castShadow = true;
		scene.add(light);

		camera.position.set(200,200,500);
		controls.target.set(200,200,0);
		controls.update();

		this.autorun(() => {
			// update size on window resize
			Session.get("window.resize");
			let width = $container.width();
			let height = $container.height();
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width,height);
		});
		let sceneObjects = new Map;
		let handle = this.data.room.others().observeChanges({
			added(id, fields) {
				console.log("added", id, fields);
				let player = ThreeObjectFactory.createPlayer();
				scene.add(player);
				sceneObjects.set(id, player);
				
			},
			changed(id, fields) {
				console.log("changed", id, fields);
				let player = sceneObjects.get(id);
				if(x in fields) {
					player.position.setX(x);
				}
				if(y in fields) {
					player.position.setY(y);
				}
				if(z in fields) {
					player.position.setZ(z);
				}
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

	 			//TWEEN.update(time);
	 		}
	 	}
	 	render();

	 });	



	ThreeObjectFactory = {
		createPlayer() {

	 	var geometry = new THREE.BoxGeometry( 200, 200, 200 );
	 	return new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: 0xff0000 } ) ) ;

	 

		}
	}
}