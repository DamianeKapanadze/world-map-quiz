import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { FeatureCollection, GeometryObject } from 'geojson';
import './WorldMap.css';

interface MapData {
  countries: FeatureCollection<GeometryObject, { name: string }>;
  land: FeatureCollection<GeometryObject, any>;
}

interface WorldMapProps {
  guessedCountries: { [countryName: string]: boolean };
  validCountries: string[];
  revealedCountries?: string[];
  focusedCountry: string | null; 
  hoveredCountry: string | null; 
}

// Territories that aren't sovereign countries
const TERRITORIES = new Set(['Greenland', 'Antarctica', 'French Guiana', 'Puerto Rico', 'Guam', 'Réunion', 'Martinique', 'Guadeloupe', 'Aruba', 'Curaçao', 'Saint Martin', 'Sint Maarten']);
// Map world-atlas names to our game names
const TERRITORY_NAME_MAP: { [key: string]: string } = {
  'St. Martin': 'Saint Martin',
  'Sint Maarten': 'Sint Maarten',
  'Czechia': 'Czech Republic',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'North Macedonia': 'North Macedonia',
  'Macedonia': 'North Macedonia',
  'Solomon Is.': 'Solomon Islands',
  'Marshall Is.': 'Marshall Islands',
  'Kiribati': 'Kiribati',
  'Tuvalu': 'Tuvalu',
  'Dominican Rep.': 'Dominican Republic',
  'Antigua and Barb.': 'Antigua and Barbuda',
  'St. Kitts and Nevis': 'Saint Kitts and Nevis',
  'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'W. Sahara': 'Western Sahara',
  'Côte d\'Ivoire': 'Côte d\'Ivoire',
  'Ivory Coast': 'Côte d\'Ivoire',
  'C.A.R.': 'Central African Republic',
  'Central African Rep.': 'Central African Republic',
  'S. Sudan': 'South Sudan',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Congo': 'Republic of the Congo',
  'Eq. Guin.': 'Equatorial Guinea',
  'Eq. Guinea': 'Equatorial Guinea',
  'Vatican': 'Vatican City',
  'São Tomé and Principe': 'Sao Tome and Principe', // Exact match from your logs
  'São Tomé and Príncipe': 'Sao Tome and Principe', // Fallback
  'Eswatini': 'Eswatini',
  'eSwatini': 'Eswatini',
  'Fr. Guiana': 'French Guiana',
  'Réunion': 'Réunion',
  'Martinique': 'Martinique',
  'Guadeloupe': 'Guadeloupe',
};



// Position adjustments for labels and dots (dx, dy in pixels)
const POSITION_ADJUSTMENTS: { [key: string]: [number, number] } = {
  'France': [15, -15],  // Move right and up by 15 pixels
  'United Kingdom': [5, 0],  // Move right by 15 pixels
  'Norway': [-25, 25],  // Move right by 10 pixels
  'Sweden': [-7, 5],  // Move right by 10 pixels
  'Croatia': [-3, 3],  // Move right by 10 pixels
  'Greece': [-4, -3],
  'Israel': [-1, 1],
  'Japan': [5, 3],
  'Chile': [-3, -3],
  'Cuba': [5, 0],
  'Haiti': [2, -2],
  'Dominican Republic': [0, 2],
  'Guyana': [0, -5],
  'Kiribati': [-533, -5],  // Move to Central Pacific Ocean near Samoa
  'Fiji': [67, 0],
};

const WorldMap: React.FC<WorldMapProps> = ({ 
  guessedCountries, 
  validCountries, 
  revealedCountries = [],
  focusedCountry,
  hoveredCountry
}) => {

  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: 500 });
  const countryPathsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gFixedRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const currentScaleRef = useRef<number>(0.8);

  // Load map data
  useEffect(() => {
    d3.json('https://unpkg.com/world-atlas@2.0.2/countries-50m.json').then((data: any) => {
      const countries = topojson.feature(data, data.objects.countries) as unknown as FeatureCollection<GeometryObject, { name: string }>;
      
      // --- FIX TUVALU ---
      // Tuvalu has ID "798" but name is undefined in this dataset. We manually fix it here.
      countries.features.forEach((feature: any) => {
        if (!feature.properties.name && feature.id === '798') {
          feature.properties.name = 'Tuvalu';
        }
      });
      // ------------------

      const land = topojson.feature(data, data.objects.land) as unknown as FeatureCollection<GeometryObject, any>;
      setMapData({ countries, land });
    });
  }, []);

  // Handle responsive sizing
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({ width, height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render map and handle interactions
  useEffect(() => {
    if (!mapData || !svgRef.current) return;

    const { width, height } = dimensions;
    
    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    countryPathsRef.current.clear();

    const projection = d3.geoEquirectangular()
      .fitSize([width, height], mapData.countries);
    projectionRef.current = projection;
      
    const pathGenerator = d3.geoPath().projection(projection);
    
    // Main group for zooming
    const g = svg.append('g');
    gRef.current = g;
    
    // Separate group for fixed-size dots and labels (will have inverse scaling applied)
    const gFixed = svg.append('g');
    gFixed.attr('class', 'fixed-size-layer');
    gFixedRef.current = gFixed;

    // Add zoom behavior with infinite zoom and 80% default scale
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 4000])
      .on('zoom', (event) => {
        // 1. Move everything normally so positions stay locked
        g.attr('transform', event.transform);
        gFixed.attr('transform', event.transform);
        
        // 2. Adjust SIZE properties instead of scaling the element
        const scale = event.transform.k;
        currentScaleRef.current = scale;

        // Resize dots
        gFixed.selectAll('circle.country-dot')
          .attr('r', 4 / scale);
          
        // Resize text
        gFixed.selectAll('text.country-label')
          .attr('font-size', `${0.7 / scale}rem`)
          .attr('stroke-width', `${0.25 / scale}rem`);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    
    // Set default zoom to 80% (0.8 scale)
    svg.call(zoom.transform, d3.zoomIdentity.scale(0.8));

    // Ocean background
    g.append('path')
      .datum({ type: 'Sphere' }) 
      .attr('class', 'sphere')
      .attr('d', pathGenerator as any)
      .attr('fill', '#202022')
      .attr('stroke', 'none');

// Graticules
    const graticule = d3.geoGraticule();
    g.append('path')
      .datum(graticule)
      .attr('d', pathGenerator as any)
      .attr('vector-effect', 'non-scaling-stroke') // <--- ADDED
      .attr('fill', 'none')
      .attr('stroke', '#3f3f46')
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.7);

    // Countries
    g.selectAll('path.country')
      .data(mapData.countries.features)
      .enter().append('path')
      .attr('class', 'country')
      .attr('d', pathGenerator as any)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('fill', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        if (!validCountries.includes(mappedName)) {
          return '#808080'; // Dark grey for non-interactable territories
        }
        if (revealedCountries.includes(mappedName)) {
          return '#ef4444'; // Red for revealed/give up countries
        }
        return guessedCountries[mappedName] ? '#34D399' : '#d3d3d3';
      })
      .attr('stroke', 'black')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .each(function (d: any) {
        countryPathsRef.current.set(d.properties.name, this);
      })
      .style('pointer-events', 'auto');

    // Add red dots for unguessed countries (on fixed layer with inverse scaling on objects)
    gFixed.selectAll('circle.country-dot')
      .data(
        mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return validCountries.includes(mappedName) && !guessedCountries[mappedName];
        })
      )
      .enter().append('circle')
      .attr('class', 'country-dot')
      .attr('cx', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        const centroid = pathGenerator.centroid(d);
        const adjustment = POSITION_ADJUSTMENTS[mappedName] || [0, 0];
        return centroid[0] + adjustment[0];
      })
      .attr('cy', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        const centroid = pathGenerator.centroid(d);
        const adjustment = POSITION_ADJUSTMENTS[mappedName] || [0, 0];
        return centroid[1] + adjustment[1];
      })
      // REMOVED: .attr('transform', ...)
      .attr('r', 4 / currentScaleRef.current) // Set radius based on zoom
      .attr('fill', '#ef4444')
      .attr('stroke', 'none')
      .attr('pointer-events', 'none');

    // Add text labels for guessed countries (on fixed layer)
    gFixed.selectAll('text.country-label')
      .data(
        mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return guessedCountries[mappedName];
        })
      )
      .enter().append('text')
      .attr('class', 'country-label')
      .attr('x', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        const centroid = pathGenerator.centroid(d);
        const adjustment = POSITION_ADJUSTMENTS[mappedName] || [0, 0];
        return centroid[0] + adjustment[0];
      })
      .attr('y', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        const centroid = pathGenerator.centroid(d);
        const adjustment = POSITION_ADJUSTMENTS[mappedName] || [0, 0];
        return centroid[1] + adjustment[1];
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#ffffff')
      .attr('stroke', '#000000')
      .attr('stroke-width', `${0.2 / currentScaleRef.current}rem`) // Scale stroke with zoom
      .style('paint-order', 'stroke fill')
      .attr('font-size', `${0.7 / currentScaleRef.current}rem`) // Set font size based on zoom
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        return mappedName;
      })
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)');

    // Territories (Greenland, Antarctica, etc.)
    g.selectAll('path.territory')
      .data(
        mapData.land.features.filter((f: any) => 
          TERRITORIES.has(f.properties?.name)
        )
      )
      .enter().append('path')
      .attr('class', 'territory')
      .attr('d', pathGenerator as any)
      .attr('vector-effect', 'non-scaling-stroke') // <--- ADDED
      .attr('fill', '#808080')
      .attr('stroke', 'black')
      .attr('stroke-width', 0.5)
      .append('title')
      .text((d: any) => d.properties?.name || 'Territory');

    // Add territory labels
    g.selectAll('text.territory-label')
      .data(
        mapData.land.features.filter((f: any) => 
          TERRITORIES.has(f.properties?.name)
        )
      )
      .enter().append('text')
      .attr('class', 'territory-label')
      .attr('x', (d: any) => {
        const centroid = pathGenerator.centroid(d);
        return centroid[0];
      })
      .attr('y', (d: any) => {
        const centroid = pathGenerator.centroid(d);
        return centroid[1];
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#808080')
      .attr('font-size', '0.75rem')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d: any) => d.properties?.name || '')
      .style('text-shadow', '0 0 3px rgba(0,0,0,0.8)');

  }, [mapData, dimensions]);

  // Update colors when guessed countries change (without resetting zoom)
  useEffect(() => {
    if (!gRef.current || !mapData) return;
    
    countryPathsRef.current.forEach((path, countryName) => {
      const mappedName = TERRITORY_NAME_MAP[countryName] || countryName;
      if (!validCountries.includes(mappedName)) {
        d3.select(path).attr('fill', '#808080');
      } else if (revealedCountries.includes(mappedName)) {
        d3.select(path).attr('fill', '#ef4444');
      } else {
        const isGuessed = guessedCountries[mappedName];
        d3.select(path).attr('fill', isGuessed ? '#34D399' : '#d3d3d3');
      }
    });
    
    const g = gRef.current;
    const gFixed = gFixedRef.current;
    const projection = projectionRef.current;
    if (!projection || !g || !gFixed) return;
    
    const pathGenerator = d3.geoPath().projection(projection);
    
    // Update dots on fixed layer: remove guessed countries, keep only unguessed
    gFixed.selectAll('circle.country-dot')
      .data(
        mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return validCountries.includes(mappedName) && !guessedCountries[mappedName];
        }),
        (d: any) => d.properties.name
      )
      .exit().remove();
    
    gFixed.selectAll('circle.country-dot')
      .data(
        mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return validCountries.includes(mappedName) && !guessedCountries[mappedName];
        }),
        (d: any) => d.properties.name
      )
      .enter().append('circle')
      .attr('class', 'country-dot')
      .attr('cx', (d: any) => {
        const centroid = pathGenerator.centroid(d);
        return centroid[0];
      })
      .attr('cy', (d: any) => {
        const centroid = pathGenerator.centroid(d);
        return centroid[1];
      })
      // REMOVED: .attr('transform', ...)
      .attr('r', 4 / currentScaleRef.current)
      .attr('fill', '#ef4444')
      .attr('stroke', 'none')
      .attr('pointer-events', 'none');
    
    // Update labels: only show for guessed countries
    gFixed.selectAll('text.country-label')
      .data(
        mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return guessedCountries[mappedName];
        }),
        (d: any) => d.properties.name
      )
      .exit().remove();
    
    gFixed.selectAll('text.country-label')
      .data(
        mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return guessedCountries[mappedName];
        }),
        (d: any) => d.properties.name
      )
      .enter().append('text')
      .attr('class', 'country-label')
      .attr('x', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        const centroid = pathGenerator.centroid(d);
        const adjustment = POSITION_ADJUSTMENTS[mappedName] || [0, 0];
        return centroid[0] + adjustment[0];
      })
      .attr('y', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        const centroid = pathGenerator.centroid(d);
        const adjustment = POSITION_ADJUSTMENTS[mappedName] || [0, 0];
        return centroid[1] + adjustment[1];
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#000000') // Fill Black
      .attr('stroke', '#ffffff') // Stroke White
      .attr('stroke-width', `${0.25 / currentScaleRef.current}rem`) // Halo thickness
      .style('paint-order', 'stroke fill') // Draw behind
      // ------------------------------
      // REMOVED: .attr('transform', ...)
      .attr('font-size', `${0.7 / currentScaleRef.current}rem`)
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        return mappedName;
      })
      .style('text-shadow', '0 0 3px rgba(255,255,255,0.8)');
  }, [guessedCountries, mapData]);


  // Effect: Smoothly zoom and pan to the focused country
  useEffect(() => {
    if (!focusedCountry || !mapData || !svgRef.current || !zoomRef.current || !projectionRef.current) return;

    // 1. Find the country feature in the data
    const feature = mapData.countries.features.find((f: any) => {
      const name = f.properties.name;
      const mappedName = TERRITORY_NAME_MAP[name] || name;
      return mappedName === focusedCountry;
    });

    if (!feature) return;

    // 2. Calculate the target center using your existing red dot logic
    const pathGenerator = d3.geoPath().projection(projectionRef.current);
    const centroid = pathGenerator.centroid(feature);
    const adjustment = POSITION_ADJUSTMENTS[focusedCountry] || [0, 0];
    const centerX = centroid[0] + adjustment[0];
    const centerY = centroid[1] + adjustment[1];

    // 3. Determine target zoom level based on country size
    const bounds = pathGenerator.bounds(feature);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const { width, height } = dimensions;

    // Adaptive Zoom Math:
    // For big countries (Russia/Canada), we want them to take up ~40% of the screen.
    // For tiny countries (Vatican/Andorra), we want to zoom in MUCH more.
    const area = dx * dy;
    let paddingFactor = 0.4; // Default: country takes up 40% of screen
    
    if (area < 0.5) { 
      // This is a "microstate" trigger (Vatican, Monaco, etc.)
      paddingFactor = 0.02; // Zoom in until the country is a tiny speck in a massive view
    } else if (area < 5) {
      // Small countries (Andorra, Singapore)
      paddingFactor = 0.1;
    }

    const autoScale = paddingFactor / Math.max(dx / width, dy / height);
    
    // Cap the zoom: 
    // Min 1.5x (so big countries don't feel too cramped)
    // Max 60x (so tiny countries are actually visible, but we don't hit the math limit)
    const targetScale = Math.max(1.5, Math.min(60, autoScale));

    // 4. Trigger the D3 transition
    const svg = d3.select(svgRef.current);
    svg.transition()
      .duration(800)
      .ease(d3.easeCubicInOut)
      .call(
        zoomRef.current.transform,
        d3.zoomIdentity
          .translate(width / 2 - targetScale * centerX, height / 2 - targetScale * centerY)
          .scale(targetScale)
      );
  }, [focusedCountry, mapData, dimensions]);

  // Effect: Highlight country when hovered in the list
  useEffect(() => {
    // 1. Clear any existing highlights first
    d3.selectAll('.country').classed('list-hovered', false);

    if (!hoveredCountry || !mapData) return;

    // 2. Find the path that matches the hovered name
    d3.selectAll('.country').filter((d: any) => {
      const name = d.properties.name;
      const mappedName = TERRITORY_NAME_MAP[name] || name;
      return mappedName === hoveredCountry;
    }).classed('list-hovered', true);
    
  }, [hoveredCountry, mapData]);
  
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity.scale(0.8));
  };

  return (
    <div className="map-wrapper">
      <svg 
        ref={svgRef} 
        className="world-map"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
      <div className="zoom-controls">
        <button onClick={handleZoomIn} title="Zoom In" className="zoom-btn zoom-in">+</button>
        <button onClick={handleResetZoom} title="Reset Zoom" className="zoom-btn zoom-reset">↺</button>
        <button onClick={handleZoomOut} title="Zoom Out" className="zoom-btn zoom-out">−</button>
      </div>
    </div>
  );
};

export default WorldMap;
