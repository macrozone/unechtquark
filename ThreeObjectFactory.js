
ThreeObjectFactory = {
	createPlayer() {

		let geometry = new THREE.BoxGeometry( 1, 1, 1);
		let player3d = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: 0xff0000 , transparent: true} ) ) ;
		return player3d;



	}
}