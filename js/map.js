/*CONSTANTS*/
const RED = "#FF0000";
const GREEN = "#00ff56";
const DEFAULT_COLOR = "#3FB1CE";
const MIN_DISTANCE = 0.5;
const MAX_DISTANCE = 10;
const MIN_WAYPOINT_COUNT = 2;
const MAX_WAYPOINT_COUNT = 10;
const ANSWER_OPTIONS = 4;
const MAX_DISTANCE_WAYPOINT = 20;
const MAX_ITERATION = 5;

const MODE = 'walking';
const DEVIATION_DISTANCE = 0.5; //in km

/*PARAMETER*/
var startPosition = null;
var waypointCount = null;
var quizDifficulty = null;
var quizCategory = null;
var requestedDistance = 0;

/*GENERATED*/
var markers = [];
var map = null;
var geolocate = null;
var waypoints = null;
var routeCoordinates = null;
var questions = null;
/*COUNTER*/
var nextWaypoint = 0;
var correctAnswersCounter = 0;
var iterations = 0;

function initMapPage() {
    let progress = document.getElementById("progress");
    let progressText = document.getElementById("progress-label");
    try {
        setURLParameters();
    } catch (e) {
        showErrorMessage(e);
        return;
    }
    updateCorrectAnswerCounterDisplay();
    let questionsLoaded = loadQuestions();
    createMap();
    progressText.innerHTML = "Loading map...";

    let waypointsLoaded = new Promise((resolve, reject) => {
        map.on('load', function () {
            geolocate._geolocateButton.hidden = "false";
            resolve();
        });
    }).then(() => {
        progress.style.width = "25%";
        progressText.innerHTML = "Locating current position...";
        // can only be triggered after map loaded
        geolocate.trigger();
        return new Promise((resolve, reject) => {
            geolocate.once('geolocate', function (position) {
                //set start position = current position
                startPosition = new mapboxgl.LngLat(position.coords.longitude, position.coords.latitude);
                console.log("Start position is " + startPosition);
                resolve();
            });
        });
    }).then(() => {
        progress.style.width = "50%";
        progressText.innerHTML = "Generating route...";
        markStartOnMap();
        let waypointsCalculated = calculateWaypoints();
        return waypointsCalculated;
    }).then(() => {
        progress.style.width = "75%";
        progressText.innerHTML = "Calculating distance to first waypoint...";
        addWaypointToMap();
        return new Promise((resolve, reject) => {
            geolocate.on('geolocate', function (position) {
                updateDistanceToWaypoint(position).then(() => resolve());
            });
        });
    }).then(() => {
        progress.style.width = "100%";
    });

    //show content after everything is loaded
    Promise.all([questionsLoaded, waypointsLoaded]).then(() => onContentLoaded()).catch(function (error) {
        showErrorMessage(error);
    });
}

function onContentLoaded() {
    let mapWrapper = document.getElementById("map-wrapper");
    let statusDisplay = document.getElementById("status-display");
    let loader = document.getElementById("loader-wrapper");
    loader.style.display = "none";
    mapWrapper.style.visibility = "visible";
    statusDisplay.style.display = "block";
    console.log('Page loaded');
}

/************************************ MAP  *****************************************/

function createMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWVpa2VkdHJzbiIsImEiOiJja2o4cmFwajEybDVoMnpsZ2M0MnY1azRlIn0.hckS8SDyVQz2EoTOJoTXTQ';
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11', // stylesheet location
        center: [8.3919476, 48.9957429], // starting position [lng, lat]
        zoom: 5 // starting zoom
    });

    geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
    });
    map.addControl(geolocate);
}

function addWaypointToMap() {
    if (nextWaypoint < waypointCount) {
        addMarker(waypoints[nextWaypoint]);
        let startToCurrentWaypoint = getStartToCurrentWaypointCoordinates();
        plotRoute(startToCurrentWaypoint);
    } else if (nextWaypoint == waypointCount) {
        plotRoute(routeCoordinates);
        console.log("Quiz finished!");
    }
}

function markStartOnMap() {
    var el = document.createElement('div');
    el.className = 'marker-start';
    new mapboxgl.Marker(el)
        .setLngLat(startPosition)
        .addTo(map);
    zoomOnPosition(startPosition, 13);
}

function zoomOnPosition(coordinate, zoom) {
    map.setCenter(coordinate);
    map.setZoom(zoom);
}

function addMarker(position, color = DEFAULT_COLOR) {
    //const el = document.createElement('div');
    const marker = new mapboxgl.Marker({color: color})
        .setLngLat(position)
        .addTo(map);
    markers.push(marker);
}

function setMarkerColor(i, color) {
    let currentMarker = markers[i];
    let position = currentMarker.getLngLat();
    let newMarker = new mapboxgl.Marker({color: color})
        .setLngLat(position)
        .addTo(map);
    markers[i] = newMarker;
}

function getStartToCurrentWaypointCoordinates() {
    let index = routeCoordinates.findIndex(function (coordinate) {
        let wp = waypoints[nextWaypoint];
        return ((coordinate[0] == wp.lng) && (coordinate[1] == wp.lat))
    });
    return routeCoordinates.slice(0, index + 1);
}

function plotRoute(coordinates) {
    if (map.getSource('route') && map.getLayer("route")) {
        var geojsonData = {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': coordinates,
            }
        };
        map.getSource('route').setData(geojsonData);

    } else {
        map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': coordinates,
                }
            }
        });

        map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#1da1f2',
                'line-width': 8
            }
        });
    }
}

/************************************ URL PARAMETER  *****************************************/
function setURLParameters() {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    requestedDistance = parseFloat(urlParams.get("distance"));
    waypointCount = parseInt(urlParams.get("num_waypoints"));
    quizDifficulty = urlParams.get("difficulty");
    quizCategory = urlParams.get("category");
    console.log("URL Parameter: distance: " + requestedDistance + "km , waypointCount: " + waypointCount + ", quizDiffulty: " + quizDifficulty + ", category: " + quizCategory);
    if (!checkURLParameter(requestedDistance, waypointCount)) {
        throw("Incorrect URL parameter")
    }
}

function checkURLParameter(distance, waypointCount) {
    if ((distance < MIN_DISTANCE) || (distance > MAX_DISTANCE)) {
        return false;
    }
    return !((waypointCount < MIN_WAYPOINT_COUNT) || (waypointCount > MAX_WAYPOINT_COUNT));
}

/************************************  Question  *****************************************/

/* Question counter */
function updateCorrectAnswerCounterDisplay() {
    let display = document.getElementById("correct-counter");
    display.innerHTML = correctAnswersCounter + " / " + waypointCount;
}

/* Load questions */
function loadQuestions() {
    let url = "https://opentdb.com/api.php?amount=" + waypointCount + "&type=multiple";
    if (quizDifficulty != "") {
        url += "&difficulty=" + quizDifficulty;
    }
    if (quizCategory != "") {
        url += "&category=" + quizCategory;
    }

    console.log(url);
    return $.getJSON(url).then(function (json) {
        if (json.response_code == 0) {
            questions = json.results;
        } else {
            return Promise.reject("Got JSON response code " + json.response_code + " from url " + url);
        }
    }).catch(() => {
        return Promise.reject("An error occurred when requesting a JSON file");
    });

}

/************************************ waypoints and route calculation *****************************************/
function calculateWaypoints() {
    let randomWaypoints = getCircularRoute();
    //route should start and end with start position
    let fullRoute = [startPosition].concat(randomWaypoints);
    fullRoute.push(startPosition);

    //get JSON route data
    let httpCoordinates = encodeURI(parseWaypointsToString(fullRoute));
    let url = 'https://api.mapbox.com/directions/v5/mapbox/' + MODE + '/' + httpCoordinates + '?geometries=geojson&access_token=' + mapboxgl.accessToken;

    return $.getJSON(url).then(function (json) {
        //actual distance in km
        let actualDistance = (parseFloat(json.routes[0].distance) / 1000).toFixed(2);

        if ((Math.abs(requestedDistance - actualDistance) > DEVIATION_DISTANCE) && (iterations < MAX_ITERATION)) {
            console.log("computed distance (deviation too big) " + actualDistance);
            iterations++;
            return calculateWaypoints();
        } else {
            routeCoordinates = json.routes[0].geometry.coordinates;
            //make sure, waypoints are on the street
            //delete start position from beginning and end
            let optimizedWaypoints = json.waypoints.map((entry) => mapboxgl.LngLat.convert(entry.location));
            waypoints = optimizedWaypoints.slice(1, optimizedWaypoints.length - 1);
            console.log("Actual distance is " + actualDistance + "km");
        }
    }).catch(() => {
        return Promise.reject("An error occurred when requesting a JSON file");
    });
}

function parseWaypointsToString(waypoints) {
//format for JSON request:"cord1.lng,coord1.lat;coord2.lng,coord2.lat"
    let waypointArray = waypoints.map(wp => wp.toArray());
    waypointArray = waypointArray.map(wp => wp.join(","));
    return waypointArray.join(";");
}

function getCircularRoute() {
    const circumferenceEarthEquator = 40075;//earth circumference around equator in km
    const circumferenceEarthPole = 40008; // cf around poles in km
    const kmPerDegreeLat = circumferenceEarthPole / 360;
//  a degree of longitude gets smaller as you move towards the poles from the equator
    const kmPerDegreeLng = (circumferenceEarthEquator / 360) * Math.cos(startPosition.lat * (Math.PI / 180));
//calculate new center
    let radius = requestedDistance / (2 * Math.PI); // r = U/2*PI

    let direction = Math.random() * 2 * Math.PI; // in radians

    let dx = radius * Math.cos(direction);
    let dy = radius * Math.sin(direction); //in km

    let deltaLat = dy / kmPerDegreeLat;
    let deltaLng = dx / kmPerDegreeLng;

    let center = new mapboxgl.LngLat(startPosition.lng + deltaLng, startPosition.lat + deltaLat);

// calculate further points on circle

    let sign = -1; //clockwise
    let initialDirection = direction + Math.PI; //turn 180degree to look in opposite direction (from center to start)

    let waypoints = [];

    const anglePerWaypoint = sign * 2 * Math.PI / (waypointCount + 1); // angle in radians per point on circle
    for (let i = 1; i <= waypointCount; i++) {
        let nextDirection = initialDirection + i * anglePerWaypoint;
        dx = radius * Math.cos(nextDirection);
        dy = radius * Math.sin(nextDirection);
        deltaLat = dy / kmPerDegreeLat;
        deltaLng = dx / (circumferenceEarthEquator / 360) * Math.cos(center.lat * (Math.PI / 180));
        waypoints[i - 1] = new mapboxgl.LngLat(center.lng + deltaLng, center.lat + deltaLat);
    }
    return waypoints;
}

function updateDistanceToWaypoint(e) {
    var position = new mapboxgl.LngLat(e.coords.longitude, e.coords.latitude);
    console.log("geolocator update, position: " + position);
    // check if quiz is finished and therefore all waypoints were visited
    let route = (nextWaypoint < waypointCount) ? [position, waypoints[nextWaypoint]] : [position, startPosition];
    let httpCoordinates = encodeURI(parseWaypointsToString(route));
    let url = 'https://api.mapbox.com/directions/v5/mapbox/' + MODE + '/' + httpCoordinates + '?geometries=geojson&access_token=' + mapboxgl.accessToken;

    return $.getJSON(url).then(function (json) {
        let distanceToWaypoint = parseFloat(json.routes[0].distance).toFixed(2);
        console.log("Distance to marker " + nextWaypoint + " is " + distanceToWaypoint + " m.");
        //update distance display
        let distanceDisplay = document.getElementById("distance-display");
        distanceDisplay.innerHTML = distanceToWaypoint + "m";
        let distanceDisplayWaypointNumber = document.getElementById("distance-display-waypointnumber");
        distanceDisplayWaypointNumber.innerHTML = (nextWaypoint < waypointCount) ? "to the " + getOrdinalNum(nextWaypoint + 1) + " waypoint" : "to your starting point";

        // Check if current position is close enough to next destination
        if ((distanceToWaypoint < MAX_DISTANCE_WAYPOINT) && (nextWaypoint < waypointCount)) {
            showQuestion();
        }
        if ((distanceToWaypoint < MAX_DISTANCE_WAYPOINT) && (nextWaypoint == waypointCount)) {
            console.log("Finished route");
            showFinished();
        }
    }).catch(() => {
        return Promise.reject("An error occurred when requesting a JSON file");
    });
}

/************************************  Quiz Dialog *****************************************/
function showQuestion() {
    resetButtons();
    let questionDisplay = document.getElementById("question");
    let currentQuestion = questions[nextWaypoint].question;
    let correctAnswer = questions[nextWaypoint].correct_answer;
    let answers = shuffleArray([correctAnswer].concat(questions[nextWaypoint].incorrect_answers));
    let correctAnswerIndex = answers.findIndex(function (el) {
        return (el == correctAnswer);
    });
    console.log("correct answer index : " + correctAnswerIndex);
    questionDisplay.innerHTML = "Question " + (nextWaypoint + 1) + " : " + currentQuestion;
    for (let i = 0; i < ANSWER_OPTIONS; i++) {
        let option = document.getElementById("option-" + i);
        option.innerHTML = answers[i];
        if (i == correctAnswerIndex) {
            option.setAttribute('data-correct', 'data-correct');
        } else {
            option.removeAttribute('data-correct');
        }
    }
    $("#staticBackdrop").modal("show");
}

function resetButtons() {
    let feedback = document.getElementById("feedback");
    feedback.style.visibility = "hidden";
    if (feedback.classList.contains("btn-success")) {
        feedback.classList.remove("btn-success");
    }
    if (feedback.classList.contains("btn-danger")) {
        feedback.classList.remove("btn-danger");
    }
    for (let i = 0; i < ANSWER_OPTIONS; i++) {
        let option = document.getElementById("option-" + i);
        option.removeAttribute("disabled");
        if (option.getAttribute("data-correct")) {
            option.removeAttribute('data-correct');
            option.classList.replace("btn-success", "btn-primary");
        } else {
            option.classList.replace("btn-danger", "btn-primary");
        }
    }
}

async function onClickAnswer(id) {
    let chosenOption = document.getElementById(id);
    let feedback = document.getElementById("feedback");
    feedback.style.visibility = "visible";
    if (chosenOption.getAttribute("data-correct")) {
        console.log("correct answer");
        feedback.classList.add("btn-success");
        feedback.innerHTML = "Correct!";
        correctAnswersCounter++;
        updateCorrectAnswerCounterDisplay();
        setMarkerColor(nextWaypoint, GREEN)
    } else {
        console.log("wrong answer");
        feedback.classList.add("btn-danger");
        feedback.innerHTML = "Incorrect :(";
        setMarkerColor(nextWaypoint, RED)
    }
    //Set all button colors
    for (let i = 0; i < ANSWER_OPTIONS; i++) {
        let option = document.getElementById("option-" + i);
        if (option.getAttribute("data-correct")) {
            option.classList.replace("btn-primary", "btn-success");
            option.classList.add("btn-success");
        } else {
            option.classList.replace("btn-primary", "btn-danger");
        }
        option.setAttribute("disabled", "disabled");
    }
    //let modal = new bootstrap.Modal(document.getElementById("staticBackdrop"));
    setTimeout(function () {
        $("#staticBackdrop").modal("hide");
    }, 1500);
    nextWaypoint++;
    console.log("next waypoint: " + nextWaypoint);
    addWaypointToMap();
    updateInstructions();
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/************************************  Instructions dialog *****************************************/
function updateInstructions() {
    let instruction = document.getElementById("instruction");
    if ((nextWaypoint) < waypointCount) {
        instruction.innerHTML = "Go to the " + getOrdinalNum(nextWaypoint + 1) + " waypoint to get your next question!";
    } else {
        instruction.innerHTML = "You answered all question. Now go back to your starting point!";
    }
}

function getOrdinalNum(number) {
    let selector;
    if (number <= 0) {
        selector = 4;
    } else if ((number > 3 && number < 21) || number % 10 > 3) {
        selector = 0;
    } else {
        selector = number % 10;
    }
    return number + ['th', 'st', 'nd', 'rd', ''][selector];
}

function showFinished() {
    let button = document.getElementById("new-route");
    button.hidden = false;
    let instruction = document.getElementById("instruction");
    instruction.hidden = true;
}

function onClickNewRound() {
    window.location = "index.html";
}

/************************************  Error Page *****************************************/
function showErrorMessage(message) {
    console.error("ERROR: " + message);
    document.getElementById("main-content").hidden = true;
    document.getElementById("error").hidden = false;

    if (message !== undefined) {
        let errorDisplay = document.getElementById("error-message");
        errorDisplay.innerHTML = JSON.stringify(message);
    }
}