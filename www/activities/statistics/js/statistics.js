/*
  Copyright 2021 David Healey

  This file is part of Waistline.

  Waistline is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Waistline is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with app.  If not, see <http://www.gnu.org/licenses/>.
*/

app.Stats = {

  el: {},
  chart: undefined,
  chartType: "bar",
  dbData: undefined,

  init: async function() {
    this.getComponents();
    this.bindUIActions();
    this.populateDropdownOptions();
    this.setChartTypeButtonVisbility();
    this.chart = undefined;
    this.dbData = await this.getDataFromDb();

    let laststat = window.localStorage.getItem("last-stat");

    if (laststat !== undefined)
      app.Stats.el.stat.value = laststat;

    if (app.Stats.el.stat.value == undefined || app.Stats.el.stat.value == "")
      app.Stats.el.stat.value = "weight";

    this.updateChart(app.Stats.el.stat.value);
    this.renderStatLog(app.Stats.el.stat.value);
  },

  getComponents: function() {
    app.Stats.el.range = document.querySelector(".page[data-name='statistics'] #range");
    app.Stats.el.stat = document.querySelector(".page[data-name='statistics'] #stat");
    app.Stats.el.chart = document.querySelector(".page[data-name='statistics'] #chart");
    app.Stats.el.barType = document.querySelector(".page[data-name='statistics'] #bar-type");
    app.Stats.el.lineType = document.querySelector(".page[data-name='statistics'] #line-type");
    app.Stats.el.timeline = document.querySelector(".page[data-name='statistics'] #timeline");
  },

  bindUIActions: function() {

    // Date range
    if (!app.Stats.el.range.hasChangedEvent) {
      app.Stats.el.range.addEventListener("change", async (e) => {
        app.Stats.dbData = await this.getDataFromDb();
        app.Stats.updateChart(app.Stats.el.stat.value);
        app.Stats.renderStatLog(app.Stats.el.stat.value);
      });
      app.Stats.el.range.hasChangedEvent = true;
    }

    // Stat field
    if (!app.Stats.el.stat.hasChangedEvent) {
      app.Stats.el.stat.addEventListener("change", (e) => {
        let value = e.target.value;
        app.Stats.updateChart(value);
        app.Stats.renderStatLog(value);
      });
      app.Stats.el.stat.hasChangedEvent = true;
    }

    // Chart type
    let buttons = Array.from(document.getElementsByClassName("chart-type"));
    buttons.forEach((x, i) => {
      if (!x.hasClickEvent) {
        x.addEventListener("click", (e) => {
          let value = Number(i != 0);

          buttons[value].style.display = "none";
          buttons[1 - value].style.display = "block";

          value == 0 ? app.Stats.chartType = "bar" : app.Stats.chartType = "line";

          app.Stats.chart.destroy();
          app.Stats.chart = undefined;
          this.updateChart(app.Stats.el.stat.value);
        });
        x.hasClickEvent = true;
      }
    });
  },

  setChartTypeButtonVisbility: function() {
    let buttons = Array.from(document.getElementsByClassName("chart-type"));
    let value = Number(app.Stats.chartType != "bar");

    buttons[value].style.display = "none";
    buttons[1 - value].style.display = "block";
  },

  populateDropdownOptions: function() {
    let nutriments = app.nutriments;

    nutriments.forEach((x, i) => {
      let option = document.createElement("option");
      option.value = x;
      let text = app.strings.nutriments[x] || x;
      option.innerHTML = app.Utils.tidyText(text);
      app.Stats.el.stat.appendChild(option);
    });
  },

  updateChart: async function(field) {
    window.localStorage.setItem("last-stat", field);

    let data = await app.Stats.organiseData(app.Stats.dbData, field);

    if (app.Stats.chart == undefined) {
      app.Stats.renderChart(data);
    } else {
      app.Stats.chart.data.labels = data.dates;
      app.Stats.chart.data.datasets[0].label = data.dataset.label;
      app.Stats.chart.data.datasets[0].data = data.dataset.values;
      app.Stats.chart.update();
    }
  },

  renderStatLog: async function(field) {
    let data = await app.Stats.organiseData(app.Stats.dbData, field);

    app.Stats.el.timeline.innerHTML = "";

    for (let i = 0; i < data.dates.length; i++) {

      let li = document.createElement("li");
      app.Stats.el.timeline.appendChild(li);

      let content = document.createElement("div");
      content.className = "item-content";
      li.appendChild(content);

      let inner = document.createElement("div");
      inner.className = "item-inner";
      content.appendChild(inner);

      let title = document.createElement("div");
      title.className = "item-title";
      title.innerHTML = data.dates[i];
      inner.appendChild(title);

      let after = document.createElement("div");
      after.className = "item-after";
      after.innerHTML = data.dataset.values[i] + " " + data.dataset.unit;
      inner.appendChild(after);
    }
  },

  organiseData: function(data, field) {
    return new Promise(async function(resolve, reject) {

      let nutrimentUnits = app.nutrimentUnits;
      let statUnits = app.Settings.getField("units");
      let stats = ["weight", "neck", "waist", "hips", "body fat"];

      let unit;
      if (field == "body fat") {
        unit = "%";
      } else {
        if (stats.indexOf(field) !== -1)
          field == "weight" ? unit = statUnits.weight : unit = statUnits.length;
        else
          unit = nutrimentUnits[field];
      }

      let result = {
        dates: [],
        dataset: {
          values: [],
          unit: unit
        }
      };

      for (let i = 0; i < data.timestamps.length; i++) {
        let value;

        if (app.nutriments.indexOf(field) == -1) {
          value = data.stats[i][field];

          if (value != undefined) {
            if (field == "weight") {
              if (unit == "lb")
                value = Math.round(value / 0.45359237 * 100) / 100;
              else if (unit == "st")
                value = Math.round(value / 6.35029318 * 100) / 100;
            } else {
              if (unit == "inch")
                value = Math.round(value / 2.54 * 100) / 100;
            }
          }

        } else {
          let nutrition = await app.FoodsMealsRecipes.getTotalNutrition(data.items[i]);
          value = nutrition[field];
        }

        if (value != undefined && value != 0 && !isNaN(value)) {
          let timestamp = data.timestamps[i];
          let date = new Intl.DateTimeFormat('en-GB').format(timestamp);
          result.dates.push(date);
          result.dataset.values.push(Math.round(value * 100) / 100);
        }
      }

      let title = field;

      if (app.strings.nutriments[field] !== undefined)
        title = app.strings.nutriments[field];
      else if (app.strings.statistics[field] !== undefined)
        title = app.strings.statistics[field];

      result.dataset.label = app.Utils.tidyText(title) + " (" + unit + ")";

      resolve(result);
    }).catch(err => {
      throw (err);
    });
  },

  getDataFromDb: function(from, range) {
    return new Promise(async function(resolve, reject) {
      let result = {
        "timestamps": [],
        "items": [],
        "stats": []
      };

      let now = from || new Date();
      let fromDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      fromDate.setHours(0, 0, 0, 0);
      let toDate = new Date(fromDate);
      toDate.setUTCHours(toDate.getUTCHours() + 24);

      let rangeValue = 0;

      if (range !== undefined)
        rangeValue = range;
      else if (app.Stats.el.range !== undefined)
        rangeValue = app.Stats.el.range.value;

      rangeValue == 7 ? fromDate.setUTCDate(fromDate.getUTCDate() - 6) : fromDate.setUTCMonth(fromDate.getUTCMonth() - rangeValue);

      dbHandler.getIndex("dateTime", "diary").openCursor(IDBKeyRange.bound(fromDate, toDate, false, true)).onsuccess = function(e) {
        let cursor = e.target.result;

        if (cursor) {

          let value = cursor.value;

          if (value.items.length > 0 || value.stats.weight != undefined) {
            result.timestamps.push(value.dateTime);
            result.items.push(value.items);
            result.stats.push(value.stats);
          }

          cursor.continue();
        } else {
          resolve(result);
        }
      };
    }).catch(err => {
      throw (err);
    });
  },

  renderChart: function(data) {
    app.Stats.chart = new Chart(app.Stats.el.chart, {
      type: app.Stats.chartType,
      data: {
        labels: data.dates,
        datasets: [{
          label: data.dataset.label,
          data: data.dataset.values,
          borderWidth: 2,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 0.5)'
        }]
      },
      options: {
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        },
        legend: {
          labels: {
            fontSize: 16
          }
        }
      }
    });
  }
};

document.addEventListener("page:init", function(event) {
  if (event.target.matches(".page[data-name='statistics']")) {
    app.Stats.init();
  }
});