<?php
	header("Content-type:application/json; charset=utf-8");

	include "libs/fun.php";

	$action = (isset($_GET['a']))? $_GET['a'] : 0;
	$parameter = (isset($_GET['p']))? $_GET['p'] : 0;
	$parameter2 = (isset($_GET['p2']))? $_GET['p2'] : 0;

	if ($action == "getTrainsByType" && $parameter != 0) {
		echo getTrainsByType($parameter);
	}
	else if ($action == "getTrainsByLocation" && $parameter != 0 && $parameter2 != 0) {
		echo getTrainsByLocation($parameter, $parameter2);
	}
	else if ($action == "getTrainsByName") {
		echo getTrainsByName($parameter);
	}
	else if ($action == "getAllTrains") {
		echo getAllTrains();
	}
	else if ($action == "getStops" && $parameter != 0) {
		echo getStops($parameter);
	}
	else if ($action == "getTrainInfo" && $parameter != 0) {
		echo getTrainInfo($parameter);
	}
	else {
		echo '{"error":"invalid parameters"}';
	}

	$db->close();
?>
