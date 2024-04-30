let currentPage = 1;
const plotsPerPage = 10;
let chartContainers = [];
const durationScaleFactor = 100000;

document.addEventListener('DOMContentLoaded', function () {
    initializeSliders();
    attachEventHandlers();
    fetchData(); // Initial fetch of data
});

function initializeSliders() {
    $("#durationSlider").slider({
        range: true,
        min: Math.round(0.000950 * durationScaleFactor),  // Scale and convert to integer
        max: Math.round(0.001500 * durationScaleFactor),  // Scale and convert to integer
        values: [Math.round(0.000964 * durationScaleFactor), Math.round(0.072732 * durationScaleFactor)],
        step: 0.00001,
        slide: function(event, ui) {
            // Display the scaled values converted back to floats
            $("#durationValue").text(
                (ui.values[0] / durationScaleFactor).toFixed(6) + ' - ' + (ui.values[1] / durationScaleFactor).toFixed(6)
            );
        }
    });

    $("#depthSlider").slider({
        range: true,
        min: 100,
        max: 700,
        values: [100, 700],
        step: 50, 
        slide: function(event, ui) {
            $("#depthValue").text(ui.values[0] + ' - ' + ui.values[1]);
        }
    });

    $("#areaSlider").slider({
        range: true,
        min: 10,
        max: 100,
        values: [20, 50],
        slide: function(event, ui) {
            $("#areaValue").text(ui.values[0] + ' - ' + ui.values[1]);
        }
    });

    $("#inflectionSlider").slider({
        range: true,
        min: 5,
        max: 1200,
        values: [5, 1200],
        slide: function(event, ui) {
            $("#inflectionValue").text(ui.values[0] + ' - ' + ui.values[1]);
        }
    });
}

function attachEventHandlers() {
    $('#updateButton').click(fetchData);

    // Pagination buttons
    $('.pagination button').click(function() {
        const direction = $(this).data('direction');
        changePage(direction);
    });
}

function appendSliderValuesToParams(checkboxId, sliderId, params, startParam, endParam, scaleFactor = 1) {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox.checked) {
        const slider = $(sliderId).slider("option", "values");
        // Scale down the slider values if necessary before appending to parameters
        const start = (slider[0] / scaleFactor).toFixed(6);  // Ensure that the number is formatted correctly
        const end = (slider[1] / scaleFactor).toFixed(6);
        params.append(startParam, start);
        params.append(endParam, end);
    }
}

function fetchData() {
    const params = new URLSearchParams({ page: currentPage, size: plotsPerPage });
    appendSliderValuesToParams('durationCheckbox', '#durationSlider', params, 'durationStart', 'durationEnd', durationScaleFactor);

    // appendSliderValuesToParams('durationCheckbox', '#durationSlider', params, 'durationStart', 'durationEnd');
    appendSliderValuesToParams('depthCheckbox', '#depthSlider', params, 'depthStart', 'depthEnd');
    appendSliderValuesToParams('areaCheckbox', '#areaSlider', params, 'areaStart', 'areaEnd');
    appendSliderValuesToParams('inflectionCheckbox', '#inflectionSlider', params, 'inflectionStart', 'inflectionEnd');
    console.log(`Fetching data with parameters: ${params.toString()}`);
    fetch(`http://localhost:8000/get-data?${params.toString()}`)
        .then(handleResponse)
        .then(updatePlotArea)
        .catch(handleFetchError);
}

function appendSliderValuesToParams(checkboxId, sliderId, params, startParam, endParam) {
    if ($('#' + checkboxId).is(':checked')) {
        let values = $(sliderId).slider("values");
        params.append(startParam, values[0]);
        params.append(endParam, values[1]);
    }
}

function handleResponse(response) {
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
}

function updatePlotArea(datasets) {
    const plotArea = $('#plotArea');
    plotArea.empty();
    chartContainers.forEach(chart => chart.destroy());
    chartContainers = [];

    if (datasets.length === 0) {
        plotArea.text('No data available');
        return;
    }

    datasets.forEach(createChart);
}

function createChart(dataset, index) {
    const chartContainer = $('<div class="chart-container"></div>');
    $('#plotArea').append(chartContainer);

    const canvas = $('<canvas></canvas>');
    chartContainer.append(canvas);

    const ctx = canvas[0].getContext('2d');
    const chartData = {
        labels: dataset.data.map((_, idx) => idx),
        datasets: [{
            label: `Dataset ${index + 1}`,
            data: dataset.data,
            fill: false,
            borderColor: 'rgb(75, 192, 192)',
            borderWidth: 1,
            tension: 0.1
        }]
    };

    const chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: chartOptions
    });

    chartContainers.push(chart);
}

const chartOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    hover: { mode: null },
    animation: { duration: 0 },
    scales: { x: { display: true }, y: { display: true } },
    elements: { line: { tension: 0 }, point: { radius: 0 } }
};

function handleFetchError(error) {
    console.error('Error fetching data:', error);
    $('#plotArea').text('Failed to load data.');
}

function changePage(direction) {
    currentPage += direction;
    $('#currentPage').text(currentPage);
    fetchData();
}
