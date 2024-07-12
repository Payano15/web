//menu toggle del dashboard

var menuToggle = document.getElementById("menu-toggle");
var wrapper = document.getElementById("wrapper");
menuToggle.addEventListener("click", function() {
    wrapper.classList.toggle("toggled");
});




var map = L.map('map').setView([18.4881, -69.8574], 13); // Coordenadas y zoom inicial en Santo Domingo Este

// Añadir el mapa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Datos de ejemplo para el mapa de calor
var heatData = [
    [37.7749, -122.4194, 0.5], // Latitud, longitud, intensidad
    [37.7849, -122.4094, 0.8],
    [37.7649, -122.4294, 0.3],
    [37.7549, -122.4394, 0.9]
];

// Añadir el mapa de calor al mapa
var heat = L.heatLayer(heatData, {
    radius: 25, // Radio del calor
    blur: 15, // Desenfoque del calor
    maxZoom: 17, // Zoom máximo donde se muestra el calor
}).addTo(map);