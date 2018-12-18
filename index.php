<?php
    $query = (isset($_GET['q'])) ? $_GET['q'] : false;
    $id = (isset($_GET['id'])) ? $_GET['id'] : false;
    $error = (isset($_GET['e'])) ? $_GET['e'] : false;
    include 'templates/main.html';
    
    if ($error) {
        echo '<script>';
        echo '$(showSearchScreen("'.$error.'"));';
    }
    else if ($query) {
        echo '<script>';
        echo '$(searchT("'.$query.'"));';
    }
    else if ($id) {
        echo '<script
        src="https://maps.googleapis.com/maps/api/js?key=AIzaSyD7o8OLl450h1HIJ0b8u-LG8isoMzmXJL4">
        </script>';
        echo '<script>';
        echo '$(showTrainMonitor("'.$id.'"));';
    }
    else {
        echo '<script>';
        echo '$(showSearchScreen(0));';
    }

    echo '</script></body></html>';

?>
