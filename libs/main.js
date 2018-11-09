$(function() {
    var user = $.cookie("uid");
    if (user) {

    }
    else {
        $.get("pages/search.html", function(data) {
            $('main').html(data);
            $("#query").keypress(function() {
                setTimeout(function() {
                    $("#query").val($("#query").val().toUpperCase());
                }, 100);
            });
        });
    }
});

function searchT() {
    var d = new Date();
    var t = d.getTime()/1000;
    $.getJSON("get.php?a=getTrainsByName&p="+$('#query').val(), function(data) {
        $('main').html("");
        $.each(data, function(i, train) {
            $.getJSON("get.php?a=getStops&p="+train.id, function(timetables) {
                let nextStation = "";
                $.each(timetables, function(i, station) {
                    if (1*station.arrival > t && nextStation == "") {
                        nextStation = station.station;
                    }
                    console.log(station.arrival + ' : '+t);
                });
                $('main').append('<div class="searchResult"><p>'+train.train_type+train.id+' '+train.first_station+' - '+train.last_station+'</p><p class="small">Seuraava asema: '+nextStation+', nopeus: '+train.speed+'km/h</p><button class="trainPicker" onclick="pickTrain('+train.id+')">Valitse</button></div>');
            });
        });
    });
}

function listTrains() {
    
    $.each(data, function(i, train) {
        $('main').append('<div class="searchResult"><p>'+train.train_type+train.id+' '+train.first_station+'-'+train.last_station+'</p><button class="trainPicker" onclick="pickTrain('+train.id+')">Valitse</button></div>');
    });
}