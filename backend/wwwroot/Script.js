async function analyzeDeck() {
    const response = await fetch("https://localhost:7295/api/deck/synergy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            cardIds: [
                26000033,
                26000025,
                26000004,
                26000023,
                26000008,
                26000007,
                26000012,
                26000015
            ]
        })
    });

    const data = await response.json();

    document.getElementById("score").innerText = data.synergyScore;
    document.getElementById("elixir").innerText = data.averageElixir;
    document.getElementById("deckType").innerText = data.deckType;

    renderChart(data.breakdown);
}

function renderChart(breakdown) {
    am5.ready(function () {

        // Clear previous chart
        document.getElementById("chartdiv").innerHTML = "";

        const root = am5.Root.new("chartdiv");
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                layout: root.verticalLayout
            })
        );

        const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 });
        const xAxis = chart.xAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "category",
                renderer: xRenderer
            })
        );

        const yAxis = chart.yAxes.push(
            am5xy.ValueAxis.new(root, {
                renderer: am5xy.AxisRendererY.new(root, {})
            })
        );

        const series = chart.series.push(
            am5xy.ColumnSeries.new(root, {
                name: "Synergy Breakdown",
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: "value",
                categoryXField: "category",
                tooltip: am5.Tooltip.new(root, {
                    labelText: "{category}: {value}"
                })
            })
        );

        series.columns.template.setAll({
            cornerRadiusTL: 8,
            cornerRadiusTR: 8,
            width: am5.percent(60)
        });

        const chartData = Object.entries(breakdown).map(([key, value]) => ({
            category: key,
            value: value
        }));

        xAxis.data.setAll(chartData);
        series.data.setAll(chartData);

        series.appear(1000);
        chart.appear(1000, 100);

    });
}
