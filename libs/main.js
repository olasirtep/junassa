var trains = {};
var timetables = {};
var id = 0;
var gmaps, marker;
var updater;
var user;
var destination = false;
var mapLock = true;
var stationMarkers = {};
var stationInfoWindows = {};

$(function() {
    showSearchScreen();
    if ($.cookie('currentDST')) destination = $.cookie('currentDST');
});

function showSearchScreen() {
    if ($.cookie('currentID')) showTrainMonitor($.cookie('currentID'));
    else {
        user = $.cookie("uid");
        if (user) {

        }
        else {
            $.get("templates/search.html", function(data) {
                $('main').html(data);
                $("#query").keypress(function() {
                    setTimeout(function() {
                        $("#query").val($("#query").val().toUpperCase());
                    }, 100);
                });
            });
        }
    }
}

function back() {
    clearInterval(updater);
    $.removeCookie('currentID');
    $.removeCookie('currentDST');
    location.reload();
}

function searchT() {
    var d = new Date();
    var t = d.getTime()/1000;
    $.getJSON("get.php?a=getTrainsByName&p="+$('#query').val(), function(data) {
        if (data.error == "empty response") alert('Palvelinvirhe');
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
                        if (station.arrived == 0 && nextStation == "" && station.order>0) {
                            nextStation = station.station;
                            lateSTR = (station.arrival_diff>0) ? ", myöhässä "+station.arrival_diff : "";
                            lateSTR += (station.arrival_diff == 1) ? " minuutti" : (station.arrival_diff>1) ? " minuuttia" : "";
                        }
                        else if (nextStation != "" && station.arrived != 0) nextStation = "";
                    });
                    $('main').append('<div class="searchResult"><p>'+train.train_type+train.id+' '+train.first_station+' - '+train.last_station+'</p><p>'+startT+' - '+endT+'</p><br><p class="small">Seuraava asema: '+nextStation+'</p><p class="xsmall">Nopeus: '+train.speed+'km/h'+lateSTR+'</p><button class="trainPicker" onclick="showTrainMonitor('+train.id+')">Valitse</button></div>');
                });
            });
        }
    });
}

function showTrainMonitor(param) {
    id = param;
    mapLock = true;
    $.cookie('currentID', id);
    var d = new Date();
    var t = d.getTime()/1000;
    $.get("templates/trainMonitor.html", function(page) {
        $('main').html('<button class="trainPicker" id="saveTrain" click="saveTrain('+id+')" disabled>Muista juna</button>');
        $('main').append(page);
        if (!destination) $('#destination').html("<p id='nodestination'>Et ole valinnut määränpäätä</p>");
        $.getJSON("get.php?a=getTrainInfo&p="+id, function(train) {
            train = train[0];
            let trainpos;
            try {
                trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};
            }
            catch (TypeError) {
                trainspos = {lat: 0, lng: 0}
            }
            gmaps = new google.maps.Map(
                document.getElementById('map'), {zoom: 10, center: trainpos});
            $('#trainTitle').text(train.train_type+train.id);
            $('#whereTowhere').text(train.first_station+" - "+train.last_station);
            marker = new google.maps.Marker({position: trainpos, title: train.train_type+train.id, icon: "https://junassa.petrimalja.com/assets/train_icon_cc0_40px.png", map: gmaps, ZIndex: 100});
            gmaps.setCenter(trainpos);
            google.maps.event.addListener(gmaps, 'dragstart', function() { mapLock = false; } );
            google.maps.event.addListener(marker, 'click', function() {
                gmaps.setCenter(trainpos);
                mapLock = true;
                $.each(stationInfoWindows, function(i, window) {
                    window.close();
                });
            });
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
        getTimeTables(train, false);
        $("#speed").html("<p class='big'>"+train.speed+"</p><p class='small'>km/h</p>");
        let trainpos = {lat: parseFloat(train.latitude), lng: parseFloat(train.longitude)};

        if (mapLock == true) gmaps.setCenter(trainpos);
        marker.setPosition(trainpos);
    });
}

function getTimeTables(train, init) {
    $('#lastUpdate').text("Viimeksi päivitetty "+formatTimeHMS(train.last_update));
    let nextStation = "";
    $.getJSON("get.php?a=getStops&p="+id, function(timetable) {
        timetables[id] = timetable;
        $('#timetable').html("");
        $.each(timetables[id], function(i, station) {
            if (station.train_stopping == 1) {
                let distance = calculateDistance(train.latitude, train.longitude, station.latitude, station.longitude);
                let arrival = formatTimeHM(station.arrival);
                let arrived = formatTimeHM(station.arrived);
                let departure = formatTimeHM(station.departure);
                let departed = formatTimeHM(station.departed);
                let fixedArrival = formatTimeHM(1*station.arrival+(station.arrival_diff*60));
                let fixedDeparture = formatTimeHM(1*station.departure+(station.departure_diff*60));
                let timetableString = '<div class="timetableRow"><h2>'+station.station;
                let arrivalDiff = (station.arrival_diff>0) ? " <b class='positive'>(+"+station.arrival_diff+")</b>" : (station.arrival_diff<0) ? " <b class='negative'>("+station.arrival_diff+")</b>" : "";
                let departureDiff = (station.departure_diff>0) ? " <b class='positive'>(+"+station.departure_diff+")</b>" : (station.departure_diff<0) ? " <b class='negative'>("+station.departure_diff+")</b>" : "";
                timetableString += (arrived || departed) ? '&#9989;</h2><br><p>' : '</h2><br><p>';
                timetableString += (arrived) ? 'Saapunut: '+arrived+arrivalDiff : (arrival) ? 'Saapuu: '+arrival : '';
                timetableString += (!arrived && station.arrival_diff>0) ? " <b>("+fixedArrival+")</b>" : "";
                timetableString += '<br>';
                timetableString += (departed) ? 'Lähti: '+departed+departureDiff : (departure) ? 'Lähtee: '+departure : '';
                timetableString += (!departed && station.departure_diff>0) ? " <b>("+fixedDeparture+")</b>" : "";
                timetableString += (!destination && !arrived && !departed) ? '<button class="trainPicker" onclick="setDestination(`'+station.station+'`)">Valitse määränpää</button>' : "";
                timetableString += '</div>';
                $("#timetable").append(timetableString);
                if (init == true) {
                    stationMarkers[station.station] = new google.maps.Marker({position: {lat: 1*station.latitude, lng: 1*station.longitude}, title: station.station, icon: "https://junassa.petrimalja.com/assets/station_circle_25px.png", map: gmaps});
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
                }
                stationInfoWindowTime = (fixedArrival) ? fixedArrival : fixedDeparture;
                stationInfoWindows[station.station].setContent('<h2>'+station.station+'<h2>'+
                                                                '<p>'+stationInfoWindowTime+'</p>'+
                                                                '<p class="xsmall">'+distance+' km</p>');
                if (station.station == destination) {
                    let destinationString = "<p class='small info'>Määränpää:</p>";
                    let distance = calculateDistance(train.latitude, train.longitude, station.latitude, station.longitude);
                    destinationString += '<p class="info">'+destination+'</p>';
                    destinationString += '<p class="small">'+distance+" km</p>";
                    destinationString += '<p id="DSTArrival" class="info">'+fixedArrival+'</p>';
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

    // Return distance in kilometers with .1 precision
    return Math.floor((ED * c)/100)/10;
}

function DegreesToRadians(degrees) {
    return degrees * (Math.PI/180);
}

function setDestination(dest) {
    destination = dest;
    $.cookie('currentDST', dest);
    $("html, body").animate({ scrollTop: 0 }, "slow");
    updateMonitor();
}

