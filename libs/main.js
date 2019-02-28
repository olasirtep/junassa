var trains = {}; // Contains train-objects
var timetables = {}; // Contains selected trains timetable-objects
var id = 0; // ID of selected train
var gmaps, marker; // Google.maps-object and train marker object
var updater; // Interval call-back for monitor update
var user; // User ID
var destination = false; // Name of the station user has selected as final destination
var mapLock = true; // When true maps center is locked on the train
var stationMarkers = {}; // Map markers for stations
var stationInfoWindows = {}; // Info windows for stations
var currentPage = "index";
var lastSpeed = 0;
var showMap = true;

function showSearchScreen(e) {
    $.get("templates/search.html", function(data) {
        $('main').html(data);
        $('#query').attr('placeholder', 'Esim. Riihimäki');
        if (e == "empty") $('#query').attr('placeholder', 'Ei osumia').val("").css('background', 'rgba(255,0,0,0.4)');
        $("#query").keypress(function(key) {
            $('#query').css('background', 'white').attr('placeholder', 'Esim. IC147');
            if (key.which == 13) window.location = '?q='+$("#query").val(); 
        });
    });
}

function back() {
    if (currentPage == "search") window.location = "?";
    else window.location = document.referrer;
}

function search() {
    if ($("#query").val() == "") alert('Hakukenttä ei voi olla tyhjä');
    else window.location = '?q='+$("#query").val();
}

function searchT(query) {
    currentPage = "search";
    var d = new Date();
    var t = d.getTime()/1000;
    $.getJSON("get.php?a=getTrainsByName&p="+query, function(data) {
        if (data.error == "empty response") window.location = "?e=empty";
        else if (data.length == 1) window.location = "?id="+data[0].id;
        else {
            $('main').html("<h2 class='VRGreen'>Hakutulokset</h2>");
            $.each(data, function(i, train) {
                trains[train.id] = train;
                $.getJSON("get.php?a=getStops&p="+train.id, function(timetable) {
                    let nextStation = "";
                    let lateSTR = "";
                    try {
                        var startT = formatTimeHM(timetable[0].departure);
                        var endT = formatTimeHM(timetable[timetable.length-1].arrival);
                    }
                    catch (TypeError) {
                    }
                    timetables[train.id] = timetable;

                    $.each(timetable, function(i, station) {
                        if (station.arrived == 0 && nextStation == "" && station.order>0 && station.train_stopping == 1) {
                            nextStation = station.station;
                            lateSTR = (station.arrival_diff>0) ? ", myöhässä "+station.arrival_diff : "";
                            lateSTR += (station.arrival_diff == 1) ? " minuutti" : (station.arrival_diff>1) ? " minuuttia" : "";
                        }
                        else if (nextStation != "" && station.arrived != 0) nextStation = "";
                    });
                    if (nextStation != "") {
                        let buttonOnClick = "window.location.href='?id="+train.id+"'";
                        let buttonSTR = '<button class="trainPicker" onclick="'+buttonOnClick+'">Valitse</button>';
                        $('main').append('<div class="searchResult"><p>'+train.train_type+train.id+' '+train.first_station+' - '+train.last_station+'</p><p>'+startT+' - '+endT+'</p><br><p class="small">Seuraava asema: '+nextStation+'</p><p class="xsmall">Nopeus: '+train.speed+'km/h'+lateSTR+'</p>'+buttonSTR+'</div>');
                    }
                });
            });
        }
    });
}

function showTrainMonitor(param) {
    currentPage = "monitor";
    id = param;
    mapLock = true;
    var d = new Date();
    var t = d.getTime()/1000;
    $.get("templates/trainMonitor.html", function(page) {
        $('main').html('<button class="trainPicker" id="saveTrain" click="saveTrain('+id+')" disabled>Muista juna</button>');
        $('main').append(page);
        if (!destination) $('#destination').html("<p id='nodestination'>Et ole valinnut määränpäätä</p>");
        $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
            train = train[0];
            trains[id] = train;
            $('#trainTitle').text(train.train_type+train.id);
            $('#whereTowhere').text(train.first_station+" - "+train.last_station);
            if (train.latitude != 0 && train.last_update > (Math.floor(Date.now()/1000)-300)) {
                showMap = true;
                let trainpos;
                try {
                    trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};
                }
                catch (TypeError) {
                    trainspos = {lat: 0, lng: 0}
                }
                gmaps = new google.maps.Map(
                    document.getElementById('map'), {zoom: 10, center: trainpos, streetViewControl: false});
                marker = new google.maps.Marker({position: trainpos, title: train.train_type+train.id, icon: "https://junassa.petrimalja.com/assets/train_icon_cc0_40px.png", map: gmaps, ZIndex: 100});
                gmaps.setCenter(trainpos);
                google.maps.event.addListener(gmaps, 'dragstart', function() { mapLock = false; } );
                google.maps.event.addListener(marker, 'click', function() {
                    gmaps.setCenter({lat: 1*trains[id].latitude, lng: 1*trains[id].longitude});
                    mapLock = true;
                    $.each(stationInfoWindows, function(i, window) {
                        window.close();
                    });
                });
            }
            else {
                showMap = false;
                $('#map').html('<h2 id="noLocation">Sijaintia ei saatavilla<h2>');
            }
            getTimeTables(train, true);
            $("#speed").html("<p class='big'>"+train.speed+"</p><p class='small'>km/h</p>");
            updater = setInterval(updateMonitor, 5000);
        });
    });
    $('#backUp').click(function () {
        $("html, body").animate({ scrollTop: 0 }, "slow");
    });
}

function updateMonitor() {
    var d = new Date();
    var t = d.getTime()/1000;

    if (!destination) $('#destination').html("<p id='nodestination'>Et ole valinnut määränpäätä</p>");

    $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
        train = train[0];
        trains[id] = train;
        getTimeTables(train, false);
	    tSpeed = (train.speed == 0 && lastSpeed == train.speed) ? "--" : train.speed;
        $("#speed").html("<p class='big'>"+tSpeed+"</p><p class='small'>km/h</p>");
        if (showMap) {
            let trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};

            if (mapLock == true) gmaps.setCenter(trainpos);
            marker.setPosition(trainpos);
        }
    });
}

function getTimeTables(train, init) {
    $('#lastUpdate').text("Viimeksi päivitetty "+formatTimeHMS(train.last_update));
    let nextStation = "";
    $.getJSON("get.php?a=getStops&p="+id, function(timetable) {
        timetables[id] = timetable;
        $('#pastStations').html("");
        $('#nextStations').html("");
        $.each(timetables[id], function(i, station) {
            if (station.train_stopping == 1) {
                let distance = calculateDistance(train.latitude, train.longitude, station.latitude, station.longitude);
                let arrival = formatTimeHM(1*station.arrival);
                let arrived = formatTimeHM(station.arrived);
                let departure = formatTimeHM(1*station.departure);
                let departed = formatTimeHM(station.departed);
                let fixedArrival = formatTimeHM(1*station.arrival+(station.arrival_diff*60));
                let fixedDeparture = formatTimeHM(1*station.departure+(station.departure_diff*60));
                let timetableString = (departed) ? '<div class="timetableRow"><h2 style="color:white;">'+station.station : '<div class="timetableRow"><h2>'+station.station;
                let arrivalDiff = (station.arrival_diff>0) ? " (<b class='positive'>"+arrival+"</b>)" : (station.arrival_diff<0) ? " <b class='negative'>"+arrival+"</b>" : "";
                let departureDiff = (station.departure_diff>0) ? " (<b class='positive'>"+departure+"</b>)" : (station.departure_diff<0) ? " <b class='negative'>"+departure+"</b>" : "";
                timetableString += (arrived || departed) ? '&#9989;</h2><br><p>' : '</h2><br><p>';
                timetableString += (arrived) ? 'Saapunut: '+arrived+arrivalDiff : (arrival) ? 'Saapuu: '+fixedArrival : '';
                timetableString += (!arrived && station.arrival_diff>0) ? " <b>("+arrival+")</b>" : "";
                timetableString += '<br>';
                timetableString += (departed) ? 'Lähtenyt: '+departed+departureDiff : (departure) ? 'Lähtee: '+fixedDeparture : '';
                timetableString += (!departed && station.departure_diff>0 && departure != 0) ? " <b>("+departure+")</b>" : "";
                timetableString += '</p><p class="xsmall" style="margin:0; padding:0;">Raide '+station.track+'</p>';
                timetableString += (!destination && !arrived && !departed) ? '<button class="trainPicker" onclick="setDestination(`'+station.station+'`)">Valitse määränpää</button>' : "";
                timetableString += '</div>';
                if (departed) $("#pastStations").append(timetableString);
                else $("#nextStations").append(timetableString);
                
                if (init == true && showMap) {
                    stationMarkers[station.station] = new google.maps.Marker({position: {lat: 1*station.latitude, lng: 1*station.longitude}, title: station.station, icon: "https://junassa.petrimalja.com/assets/station_circle_25px.png", map: gmaps, ZIndex: 1});
                    stationInfoWindows[station.station] = new google.maps.InfoWindow({
                        content: '<h2>'+station.station+'<h2>'+
                                    '<p>'+arrival+'</p>'+
                                    '<p>'+distance+' km</p>'
                    });
                    stationMarkers[station.station].addListener('click', function() {
                        mapLock = false;
                        $.each(stationInfoWindows, function(i, window) {
                            window.close();
                        });
                        stationInfoWindows[station.station].open(gmaps, stationMarkers[station.station]);
                    });
                    stationInfoWindowTime = (fixedArrival) ? fixedArrival : fixedDeparture;
                    stationInfoWindows[station.station].setContent('<h2>'+station.station+'<h2>'+
                                                                    '<p>'+stationInfoWindowTime+'</p>'+
                                                                    '<p class="xsmall">'+distance+' km</p>');
                }
        
                if (station.station == destination) {
                    let destinationString = "<p class='small info'>Määränpää:</p>";
                    let distance = calculateDistance(train.latitude, train.longitude, station.latitude, station.longitude);
                    destinationString += '<p class="info">'+destination+'</p>';
                    destinationString += '<p class="small">'+distance+" km</p>";
                    destinationString += '<p id="DSTArrival" class="info">'+fixedArrival+'</p>';
                    destinationString += (station.arrival_diff>0) ? "<p class='small'>("+arrival+")</p>" : "";
                    $('#destination').html(destinationString);
                    if (station.arrival_diff > 0) $("#DSTArrival").css('color', 'red');
                    else $("#DSTArrival").css('color', 'green');
                }
                if (!arrived && nextStation == "" && station.order>0) {
                    nextStation = station.station;
                    let distance = calculateDistance(train.latitude, train.longitude, station.latitude, station.longitude);
                    let nextStationSTR = "<p class='small' style='margin-top:20px;'>Seuraavana:</p><p style='margin-top:20px;'>"+nextStation+"</p>";
                    nextStationSTR += "<p class='small'>"+distance+" km</p>";
                    nextStationSTR += "<p style='margin-top:20px' id='NXTArrival'>"+fixedArrival+"</p>";
                    nextStationSTR += (station.arrival_diff>0) ? "<p class='small'>("+arrival+")</p>" : "";
                    $("#next_station").html(nextStationSTR);
                    if (station.arrival_diff > 0) $("#NXTArrival").css('color', 'red');
                    else $("#NXTArrival").css('color', 'green');
                }
                else if (nextStation != "" && arrived) nextStation = "";
            }
        });
    });
}

function formatTimeHM(timestamp) {
    if (timestamp>0) {
        let d = new Date(timestamp*1000);
        let hours = (d.getHours()<10) ? "0"+d.getHours() : d.getHours();
        let minutes = (d.getMinutes()<10) ? "0"+d.getMinutes() : d.getMinutes();
        return hours+":"+minutes;
    }
    else return false;
}

function formatTimeHMS(timestamp) {
    if (timestamp>0) {
        let d = new Date(timestamp*1000);
        let hours = (d.getHours()<10) ? "0"+d.getHours() : d.getHours();
        let minutes = (d.getMinutes()<10) ? "0"+d.getMinutes() : d.getMinutes();
        let seconds = (d.getSeconds()<10) ? "0"+d.getSeconds() : d.getSeconds();
        return hours+":"+minutes+":"+seconds;
    }
    else return false;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    var ED = 6371e3;
    var latRad1 = DegreesToRadians(lat1);
    var latRad2 = DegreesToRadians(lat2);
    var diffLat = DegreesToRadians(lat2-lat1);
    var diffLon = DegreesToRadians(lon2-lon1);

    var a = Math.sin(diffLat/2) * Math.sin(diffLat/2) +
            Math.cos(latRad1) * Math.cos(latRad2) *
            Math.sin(diffLon/2) * Math.sin(diffLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    // Return distance in kilometers with 1 decimals
    return Math.floor((ED * c)/100)/10;
}

function DegreesToRadians(degrees) {
    return degrees * (Math.PI/180);
}

function setDestination(dest) {
    destination = dest;
    $("html, body").animate({ scrollTop: 0 }, "slow");
    updateMonitor();
}

