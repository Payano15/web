// document.addEventListener('DOMContentLoaded', function() {
//     // Initialize the map
//     var map = L.map('map').setView([51.505, -0.09], 13);

//     // Add a tile layer
//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//         attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
//     }).addTo(map);

//     // Handle map click event
//     map.on('click', function(e) {
//         var latitude = e.latlng.lat;
//         var longitude = e.latlng.lng;

//         // Update the form fields
//         document.getElementById('latitude').value = latitude;
//         document.getElementById('longitude').value = longitude;

//         // Add marker to the map
//         L.marker([latitude, longitude]).addTo(map);
//     });
// });

document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('map').setView([18.7357, -70.1627], 8); // Coordenadas de la República Dominicana
    var marker = null;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function(e) {
        var latitude = e.latlng.lat;
        var longitude = e.latlng.lng;

        // Update the form fields
        document.getElementById('latitude').value = latitude;
        document.getElementById('longitude').value = longitude;

        // Remove previous marker if it exists
        if (marker !== null) {
            map.removeLayer(marker);
        }

        // Add new marker to the map
        marker = L.marker([latitude, longitude]).addTo(map);
    });
});