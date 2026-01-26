import * as topojson from 'topojson-client';

// Helper to clean up names (matching your existing map logic)
export const normalizeName = (name: string) => {
  const NAME_MAP: { [key: string]: string } = {
    'United States of America': 'United States',
    'Dem. Rep. Congo': 'Democratic Republic of the Congo',
    'Congo': 'Republic of the Congo',
    'S. Sudan': 'South Sudan',
    'Central African Rep.': 'Central African Republic',
    // ... add any other specific overrides from your list here
  };
  return NAME_MAP[name] || name;
};

export const buildAdjacencyList = (topology: any) => {
  const neighborMap = new Map<string, string[]>();
  
  // Get the raw geometry objects
  const geometries = topology.objects.countries.geometries;
  
  // TopoJSON does the math for us
  const neighborsIndices = topojson.neighbors(geometries);

  geometries.forEach((geo: any, index: number) => {
    const countryName = normalizeName(geo.properties.name);
    
    // Get the indices of neighbors, map them to names
    const neighborNames = neighborsIndices[index]
      .map((nIndex: number) => normalizeName(geometries[nIndex].properties.name))
      .filter((n: string) => n !== countryName); // Remove self

    // Only add if it has neighbors (filters out isolated islands)
    if (neighborNames.length > 0) {
      neighborMap.set(countryName, neighborNames);
    }
  });

  return neighborMap;
};