WALK_DELTA = 0.3;
TICK_INTERVAL = 50;

// global server tween update
if(Meteor.isServer) {
	Meteor.startup(() => {
		Meteor.setInterval(() => TWEEN.update(), TICK_INTERVAL);
	})
}

RoomEngine = class {
	constructor(roomId) {
		this.roomId = roomId;
		this.sceneObjects = new Map;
		this.scene = new THREE.Scene;
		this.raycaster = new THREE.Raycaster();
	}

	setClient(client) {
		if(this.client) {
			throw new Meteor.Error("cannot add two clients");
		}
		this.client = client;
		
		this.client.controls.enabled = true;
		this.scene.add(this.client.controls.getObject());
	}

	start(){
		if(!this.isRunning) {
			this.intervalHandle = Meteor.setInterval(() => this.tick(), TICK_INTERVAL);
			this.startObserving();
			this.isRunning = true;
		}
	}



	setPositionFields(position, fields) {
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
		if(position.tween) position.tween.stop();
		let tween = new TWEEN.Tween(position);
		position.tween = tween;
		tween.to(pos, TICK_INTERVAL);
		tween.easing(TWEEN.Easing.Quadratic.Out);
		tween.start()
	}

	setRotationFields(rotation, fields) {
		let pos = {};

		if(_.has(fields, "lookX")) {
			pos.x = fields.lookX;
		}
		if(_.has(fields, "lookZ")) {
			pos.y = fields.lookZ;
		}
		
		let tween = new TWEEN.Tween(rotation);
		tween.to(pos, TICK_INTERVAL);

		//tween.easing(TWEEN.Easing.Linear);
		tween.start()
	}

	startObserving() {

		let cursor = Meteor.isClient ? this.room().others() : this.room().players();
		let engine = this;
		// handle others
		this.observeHandle = cursor.observeChanges({
			added(id, fields) {
				//console.log("added", id, fields);
				let player = ThreeObjectFactory.createPlayer();
				player.playerId = id;
				engine.setPositionFields(player.position, fields);
				engine.setRotationFields(player.rotation, fields);

				engine.scene.add(player);

				engine.sceneObjects.set(id, player);
			},
			changed(id, fields) {
				//console.log("changed", id, fields);
				let player = engine.sceneObjects.get(id);

				engine.setPositionFields(player.position, fields);
				engine.setRotationFields(player.rotation, fields);

				if(fields.isDead) {
					player.material.opacity = 0.3;
				}
				else {
					player.material.opacity = 1;
				}
			},

			removed(id) {
				console.log("removed", id);
				let player = engine.sceneObjects.get(id);
				engine.scene.remove(player);
				engine.sceneObjects.delete(id);
			}
		});


	}


	clientSetPosition({x,y,z}) {
		
		this.setPositionFields(this.client.controls.getObject().position,{x,y,z});
	}

	shoot(player) {

		this.raycaster.set(player.positionV3(), player.directionV3());
		let players = this.room().others(player.userId).map((player) => {
			let player3d = this.sceneObjects.get(player._id);
			if(Meteor.isServer) player3d.updateMatrixWorld(); // needed, otherwise it will not hit
			return player3d;
		});
		let hit = _.first(this.raycaster.intersectObjects(players));

		if(hit) {
			let hitPlayer = Players.findOne(hit.object.playerId);
			if(!hitPlayer.isDead) {
				this.kill(hitPlayer._id);
				Players.update(player._id, {$inc: {kills: 1}});

				console.log("hit!");
			}
			else
			{
				console.log("already dead, you bastard");
			}
			
		}
	}
	kill(playerId) {
		Players.update(playerId,{$set: {isDead: true}})
		if(Meteor.isServer) {
			Meteor.setTimeout(() => {
				Players.update(playerId, {$set: {isDead: false}});
			}, 5000);
		}
	}

	stop() {
		Meteor.clearInterval(this.intervalHandle);
		this.observeHandle.stop();
		if(this.clientObserveHandle) {
			this.clientObserveHandle.stop();
		}
		this.isRunning = false;
	}

	tick() {


		this.room().players().forEach((player) => {
			let {x,y,z,lookX, lookY, lookZ} = player;


			if(player.forward){
				z += lookZ*WALK_DELTA;
				x += lookX*WALK_DELTA;

			}
			if(player.backward){
				z -= lookZ*WALK_DELTA;
				x -= lookX*WALK_DELTA;
			}
			if(player.left){
				z -= lookX*WALK_DELTA;
				x += lookZ*WALK_DELTA;
			}
			if(player.right){
				z += lookX*WALK_DELTA;
				x -= lookZ*WALK_DELTA;
			}

			if(Meteor.isServer){
				Players.update(player._id, {$set: {x,y,z}});
			}else{
				//Players.update not allowed on the client, just update the scene objects 
				if(Meteor.isClient && player.isMe()) {
					this.clientSetPosition({x,y,z});
				}
				else{
					let player3d = this.sceneObjects.get(player._id);
					this.setPositionFields(player3d.position, {x,y,z});
				}
				
				
			}
		});

	}

	room() {
		return Rooms.findOne(this.roomId);
	}
}





Meteor.methods({
	["Player.forward"](forward) {

		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {forward}});
	},
	["Player.backward"](backward) {
		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {backward}});
	},
	["Player.left"](left) {
		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {left}});
	},
	["Player.right"](right) {
		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {right}});
	},
	["Player.lookX"](lookX) {
		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {lookX}});
	},
	["Player.lookY"](lookY) {
		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {lookY}});
	},
	["Player.lookZ"](lookZ) {
		let player = Players.findOne({userId:this.userId});
		if(player)
			Players.update({_id: player._id}, {$set: {lookZ}});
	},
	["Player.shoot"]() {
		let player = Players.findOne({userId:this.userId});
		player.currentRoom().engine().shoot(player);
	},

})