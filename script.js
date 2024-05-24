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
    const minVal = 0.00080;
    const maxVal = 0.10;
    const logMin = Math.log(minVal);
    const logMax = Math.log(maxVal);

    $("#durationSlider").slider({
        range: true,
        min: logMin,
        max: logMax,
        values: [Math.log(0.00080), Math.log(0.1)],
        step: 0.001, // Adjust the step to a reasonable increment in the logarithmic scale
        slide: function(event, ui) {
            // Convert log values back to linear scale for display
            const val1 = Math.exp(ui.values[0]);
            const val2 = Math.exp(ui.values[1]);
            $("#durationValue").text(val1.toFixed(6) + ' - ' + val2.toFixed(6));
        }
    });

    $("#depthSlider").slider({
        range: true,
        min: 0,
        max: 1900,
        values: [0, 1900],
        step: 50, 
        slide: function(event, ui) {
            $("#depthValue").text(ui.values[0] + ' - ' + ui.values[1]);
        }
    });

    $("#areaSlider").slider({
        range: true,
        min: 0,
        max: 10,
        values: [0, 10],
        slide: function(event, ui) {
            $("#areaValue").text(ui.values[0] + ' - ' + ui.values[1]);
        }
    });

    $("#inflectionSlider").slider({
        range: true,
        min: 1,
        max: 1600,
        values: [1, 1600],
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

    // Checkbox bindings
    ['durationCheckbox', 'depthCheckbox', 'areaCheckbox', 'inflectionCheckbox', 'categoryCheckbox'].forEach(checkboxId => {
        bindCheckboxWithSlider(checkboxId);
    });
}

function bindCheckboxWithSlider(checkboxId) {
    const sliderId = '#' + checkboxId.replace('Checkbox', checkboxId.endsWith('SelectCheckbox') ? 'Select' : 'Slider');
    $('#' + checkboxId).change(function() {
        if (this.checked) {
            $(sliderId).prop('disabled', false);
            $('#plotArea').removeClass('no-scroll');
        } else {
            $(sliderId).prop('disabled', true);
            $('#plotArea').addClass('no-scroll');
        }
    });
}


function fetchData() {
    const plotArea = $('#plotArea');
    plotArea.html('<img src="images/loading.gif" class="loading" alt="Loading..." style="display: block; margin: auto; width: 50px; height: 50px;"  />');   // Show loading indicator

    const params = new URLSearchParams({ page: currentPage, size: plotsPerPage });
    appendSliderValuesToParams('durationCheckbox', '#durationSlider', params, 'durationStart', 'durationEnd', scaleFactor=1);

    // appendSliderValuesToParams('durationCheckbox', '#durationSlider', params, 'durationStart', 'durationEnd');
    appendSliderValuesToParams('depthCheckbox', '#depthSlider', params, 'depthStart', 'depthEnd', scaleFactor=0);
    appendSliderValuesToParams('areaCheckbox', '#areaSlider', params, 'skewnessStart', 'skewnessEnd', scaleFactor=0);
    appendSliderValuesToParams('inflectionCheckbox', '#inflectionSlider', params, 'inflectionStart', 'inflectionEnd', scaleFactor=0);
    appendCategoryToParams(params);  // Append category filter
    console.log(`Fetching data with parameters: ${params.toString()}`);
    fetch(`http://localhost:8000/get-data?${params.toString()}`)
        .then(handleResponse)
        .then(data => {
            updatePlotArea(data);
            $('.loading').remove(); // Remove loading image after data is loaded
        })
        .catch(error => {
            handleFetchError(error);
            $('.loading').remove(); // Remove loading image in case of fetch error
        });

}

function appendSliderValuesToParams(checkboxId, sliderId, params, startParam, endParam) {
    if ($('#' + checkboxId).is(':checked')) {
        let values = $(sliderId).slider("values");
        if (scaleFactor==1){
            params.append(startParam, Math.exp(values[0]));
            params.append(endParam, Math.exp(values[1]));
        }
        else {
            params.append(startParam, values[0]);
            params.append(endParam, values[1]);

        }
        
    }
}
function appendCategoryToParams(params) {
    if ($('#categoryCheckbox').is(':checked')) {
        const category = $('#categorySelect').val();
        if (category !== 'all') {
            params.append('category', category);
        }
        // else {
        //     params.append('category', 'all'); 
        // }
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
        $('#filteredResults').text(`Filtered: 0`);
        $('#percentageResults').text(`0 %`)
        return;
    }
    // Update filtered and total files count
    $('#filteredResults').text(`Filtered: ${datasets[0].filtered_files}`);
    $('#totalResults').text(`Total: ${datasets[0].total_files}`);
    $('#percentageResults').text(`Percentage: ${datasets[0].total_files > 0 ? ((datasets[0].filtered_files / datasets[0].total_files) * 100).toFixed(2) : 0}%`);
 
    datasets.forEach(createChart);
}

function createChart(dataset, index) {
    const chartContainer = $('<div class="chart-container"></div>');
    const fileID = $('<div class="chart-title"></div>').text(`File ID: ${dataset.file_id}`);
    chartContainer.append(fileID);
    $('#plotArea').append(chartContainer);

    const canvas = $('<canvas></canvas>');
    chartContainer.append(canvas);

    const ctx = canvas[0].getContext('2d');

    // Assuming dataset includes 'data' and 'smoothed_data'
    const chartData = {
        labels: dataset.data.map((_, idx) => idx),
        datasets: [
            {
                label: `Dataset ${index + 1}`,
                data: dataset.data,
                fill: false,
                borderColor: 'rgb(75, 192, 192)', // Original data in blue
                borderWidth: 1,
                tension: 0.1
            },
            {
                label: `Smoothed ${index + 1}`,
                data: dataset.smoothed_data,
                fill: false,
                borderColor: 'rgb(255, 99, 132)', // Smoothed data in red
                borderWidth: 3,
                tension: 0.1
            }
        ]
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
    scales: { x: { display: true }, y: { display: true , suggestedMin: 200} },
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
