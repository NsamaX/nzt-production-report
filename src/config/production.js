export const productionConfig = {
  statusRows: [
    {
      name: 'Production',
      color: '#C6E0B3',
      chartType: 'bar',
      order: 1,
      barPercentage: 0.8,
      categoryPercentage: 0.8,
    },
    {
      name: 'Forecast',
      color: '#4574C4',
      chartType: 'bar',
      order: 2,
      barPercentage: 0.8,
      categoryPercentage: 0.8,
    },
    {
      name: 'Capacity',
      color: '#F07730',
      chartType: 'line',
      order: 3,
      tension: 0.1,
      pointRadius: 1.6,
    },
    {
      name: 'Capacity + OT',
      color: '#FABC02',
      chartType: 'line',
      order: 4,
      tension: 0.1,
      pointRadius: 1.6,
    },
  ],
};
