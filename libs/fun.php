<?php
include 'db.php';

function generateJSON($result) {
    $json = "[";

    while($row = $result->fetch_assoc()) {
        $json .= '{';
        foreach ($row as $key => $value) {
            $json .= '"'.$key.'":"'.$value.'",';
        }
        $json = substr($json,0,-1);
        $json .= '},';
    }
    $json = substr($json,0,-1);
    $json .= ']';

    $json = ($json == ']') ? '{"error":"empty response"}' : $json;
    
    return utf8_encode($json);
}

function getTrainsByType($param) {
    global $db;
    $param = '%'.$param.'%';
    $stmt = $db->prepare("SELECT * FROM `trains` WHERE `train_type` LIKE ? AND longitude != 0");
    $stmt->bind_param("s", $param);
    $stmt->execute();

    return generateJSON($stmt->get_result());
}

function getTrainsByLocation($coordinates, $radius) {
    global $db;
    /*
    *   TODO: query trains that are inside the radius from given coordinates
    */
    $coordinates = explode(";", $coordinates);
    $stmt = $db->prepare("SELECT * FROM `trains` WHERE `latitude`+? < ? AND `latitude`-? > ? AND `longitude`+? < ? AND `longitude`-? > ?");
    $stmt->bind_param("dddddddd", $radius, $coordinates[0], $radius, $coordinates[0], $radius, $coordinates[1], $radius, $coordinates[1]);
    $stmt->execute();

    return generateJSON($stmt->get_result());
}

function getTrainsByName($param) {
    global $db;
    /*
    *   TODO: query trains based on name, eg. IC147
    */
    $param = strtolower($param);
    $param = str_replace(' ', '', $param);
    $param = str_replace('ä', 'a', $param);
    $param = str_replace('ö', 'o', $param);
    $param = '%'.$param.'%';

    $now = time();
    $t = $now-300;
    

    if (strlen($param)>3) {

        $stmt = $db->prepare("SELECT DISTINCT trains.id, trains.speed, trains.longitude, trains.latitude, trains.train_type, trains.first_station, trains.last_station, trains.last_update FROM `trains` LEFT JOIN `timetables` ON trains.id=timetables.id WHERE concat(trains.train_type, trains.id, timetables.station_ASCII) LIKE ? and timetables.train_stopping = 1 and (timetables.arrival > ? or timetables.departure > ?)");
        $stmt->bind_param("sii", $param, $now, $now);
    }
    else {
        $stmt = $db->prepare("SELECT * FROM `trains` WHERE concat(train_type, id) LIKE ? AND last_update > ?");
        $stmt->bind_param("si", $param, $t);
    }
    $stmt->execute();

    return generateJSON($stmt->get_result());
}

function getAllTrains() {
    global $db;
    /*
    *   TODO: get all trains from database
    */
    $t = time()-300;
    return generateJSON($db->query("SELECT * FROM trains WHERE longitude != 0 and last_update > ".$t));
}

function getStops($id) {
    global $db;
    /*
    *   TODO: get timetable for train
    */
    $stmt = $db->prepare("SELECT * FROM timetables WHERE id = ? ORDER BY arrival");
    $stmt->bind_param("i",$id);
    $stmt->execute();

    return generateJSON($stmt->get_result());
}

function getTrainInfo($param) {
    global $db;
    /*
    *   TODO: get information about the train from 'junat'-table
    */
    $stmt = $db->prepare("SELECT * FROM `trains` WHERE `id` = ?");
    $stmt->bind_param("i",$param);
    $stmt->execute();

    return generateJSON($stmt->get_result());
}

?>
