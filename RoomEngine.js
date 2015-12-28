WALK_DELTA = 0.3;
RoomEngine = class {
	constructor(roomId) {
		this.roomId = roomId;

	}


	start(){
		if(!this.isRunning) {
			this.intervalHandle = Meteor.setInterval(() => this.tick(), 100);
			this.isRunning = true;
		}
		
	}

	stop() {
		Meteor.clearInterval(this.intervalHandle);
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
			Players.update(player._id, {$set: {x,y,z}});
		});
	}

	room() {
		return Rooms.findOne(this.roomId);
	}
}