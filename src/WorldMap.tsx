import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { FeatureCollection, GeometryObject } from 'geojson';
import './WorldMap.css';

interface MapData {
  countries: FeatureCollection<GeometryObject, { name: string }>;
  land: FeatureCollection<GeometryObject, any>;
}

// 1. UPDATE INTERFACE
interface WorldMapProps {
  // Shared
  rawMapData?: any; // New prop from App
  mode: 'classic' | 'neighbors'; // New prop
  validCountries: string[];
  focusedCountry: string | null; 
  hoveredCountry: string | null; 
  
  // Classic Mode Props
  guessedCountries?: { [countryName: string]: boolean };
  revealedCountries?: string[];
  
  // Neighbors Mode Props
  targetCountry?: string | null;
  foundNeighbors?: string[];
  isHardMode?: boolean;
  gameStatus?: string;
  revealedByGiveUp?: string[];
}

const TERRITORIES = new Set(['Greenland', 'Antarctica', 'French Guiana', 'Puerto Rico', 'Guam', 'Réunion', 'Martinique', 'Guadeloupe', 'Aruba', 'Curaçao', 'Saint Martin', 'Sint Maarten']);

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
  'St Vincent and Grenadines': 'Saint Vincent and the Grenadines',
  'St Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
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
  'São Tomé and Principe': 'Sao Tome and Principe',
  'São Tomé and Príncipe': 'Sao Tome and Principe',
  'Eswatini': 'Eswatini',
  'eSwatini': 'Eswatini',
  'Fr. Guiana': 'French Guiana',
  'Réunion': 'Réunion',
  'Martinique': 'Martinique',
  'Guadeloupe': 'Guadeloupe',
};

const POSITION_ADJUSTMENTS: { [key: string]: [number, number] } = {
  'France': [15, -15],
  'United Kingdom': [5, 0],
  'Norway': [-25, 25],
  'Sweden': [-7, 5],
  'Croatia': [-3, 3],
  'Greece': [-4, -3],
  'Israel': [-1, 1],
  'Japan': [5, 3],
  'Chile': [-3, -3],
  'Cuba': [5, 0],
  'Haiti': [2, -2],
  'Dominican Republic': [0, 2],
  'Guyana': [0, -5],
  'Kiribati': [-533, -5],
  'Fiji': [67, 0],
};

const WorldMap: React.FC<WorldMapProps> = ({ 
  rawMapData,
  mode,
  guessedCountries = {}, 
  validCountries, 
  revealedCountries = [],
  focusedCountry,
  hoveredCountry,
  // Neighbors props
  targetCountry,
  foundNeighbors = [],
  isHardMode = false,
  gameStatus,
  revealedByGiveUp = []
}) => {

  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const countryPathsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const gFixedRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const currentScaleRef = useRef<number>(0.8);
  const pathGeneratorRef = useRef<d3.GeoPath | null>(null);

  // Hardcoded Tuvalu (10m geometry) - KEPT AS IS
  const TUVALU_10M_GEOMETRY = {
    type: "Feature",
    id: "798",
    properties: { name: "Tuvalu" },
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [[[179.189991899919, -8.541955355356691], [179.20079200792009, -8.5301353144675], [179.20439204392045, -8.518315273578324], [179.20079200792009, -8.50987238722891], [179.19719197191972, -8.498052346339733], [179.19719197191972, -8.481166573640905], [179.20079200792009, -8.460903646402315], [179.2079920799208, -8.47441226456138], [179.2079920799208, -8.498052346339733], [179.21519215192154, -8.511560964498798], [179.2187921879219, -8.520003850848212], [179.2079920799208, -8.5301353144675], [179.189991899919, -8.541955355356691]]],
        [[[178.379983799838, -8.070842297059414], [178.37278372783732, -8.069153719789526], [178.37638376383762, -8.055645101630475], [178.38358383583835, -8.038759328931647], [178.39078390783908, -8.026939288042456], [178.379983799838, -8.070842297059414]]],
        [[[177.15237152371526, -7.19784784853006], [177.15237152371526, -7.194470693990297], [177.1487714877149, -7.19109353945052], [177.1487714877149, -7.1877163849107575], [177.15237152371526, -7.194470693990297], [177.15237152371526, -7.199536425799934], [177.15237152371526, -7.19784784853006]]],
        [[[176.31356313563134, -6.3029018954922265], [176.32076320763207, -6.289393277333161], [176.32436324363243, -6.289393277333161], [176.32076320763207, -6.2944590091428125], [176.31356313563134, -6.3029018954922265]]],
        [[[177.34317343173433, -6.120535550344897], [177.33957339573396, -6.113781241265372], [177.33957339573396, -6.110404086725595], [177.3359733597336, -6.10871550945572], [177.35037350373506, -6.110404086725595], [177.35757357573578, -6.113781241265372], [177.35757357573578, -6.118846973075009], [177.34317343173433, -6.120535550344897]]],
        [[[176.13356133561336, -5.693325501064578], [176.12636126361264, -5.679816882905513], [176.129961299613, -5.678128305635624], [176.1407614076141, -5.686571191985038], [176.14796147961482, -5.706834119223629], [176.13356133561336, -5.693325501064578]]],
        [[[179.90639906399065, -9.399752608457092], [179.90639906399065, -9.418326958425808], [179.90639906399065, -9.420015535695683], [179.90279902799028, -9.399752608457092], [179.89919899198992, -9.386243990298041], [179.90279902799028, -9.387932567567915], [179.90639906399065, -9.399752608457092]]],
        [[[179.8667986679867, -9.344029558550972], [179.87399873998743, -9.347406713090734], [179.8775987759878, -9.3609153312498], [179.8775987759878, -9.362603908519674], [179.87039870398706, -9.350783867630497], [179.8667986679867, -9.344029558550972]]],
        [[[178.68238682386823, -7.491660293489645], [178.66798667986683, -7.46295447990164], [178.66438664386646, -7.454511593552226], [178.68958689586896, -7.474774520790817], [178.69318693186932, -7.483217407140231], [178.69318693186932, -7.493348870759533], [178.69318693186932, -7.498414602569184], [178.68238682386823, -7.491660293489645]]]
      ]
    }
  } as any;

  // 1. Data Processing (Updated to use rawMapData from prop)
  useEffect(() => {
    if (rawMapData) {
      const countries50m = topojson.feature(rawMapData, rawMapData.objects.countries) as any;
      const land = topojson.feature(rawMapData, rawMapData.objects.land) as any;
      
      const filteredFeatures = countries50m.features.filter((f: any) => f.id !== 798 && f.id !== "798");
      filteredFeatures.push(TUVALU_10M_GEOMETRY);
      countries50m.features = filteredFeatures;
      
      setMapData({ countries: countries50m, land });
    }
  }, [rawMapData]);

  // 2. Handle Window Resize (Kept Same)
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. MAIN RENDER (Kept Same)
  useEffect(() => {
    if (!mapData || !svgRef.current) return;
    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);
    svg.selectAll('*').remove();
    countryPathsRef.current.clear();

    const projection = d3.geoEquirectangular().fitSize([width, height], mapData.countries);
    projectionRef.current = projection;
    
    const pathGenerator = d3.geoPath().projection(projection);
    pathGeneratorRef.current = pathGenerator;
    
    const g = svg.append('g');
    gRef.current = g;
    const gFixed = svg.append('g').attr('class', 'fixed-size-layer');
    gFixedRef.current = gFixed;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 4000])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        gFixed.attr('transform', event.transform);
        const scale = event.transform.k;
        currentScaleRef.current = scale;
        gFixed.selectAll('circle.country-dot').attr('r', 4 / scale);
        gFixed.selectAll('text.country-label')
          .attr('font-size', `${0.7 / scale}rem`)
          .attr('stroke-width', `${0.25 / scale}rem`);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.scale(0.8));

    g.append('path').datum({ type: 'Sphere' }).attr('d', pathGenerator as any).attr('fill', '#202022').attr('stroke', 'none');
    g.append('path').datum(d3.geoGraticule()).attr('d', pathGenerator as any).attr('vector-effect', 'non-scaling-stroke').attr('fill', 'none').attr('stroke', '#3f3f46').attr('stroke-width', 0.5).attr('stroke-opacity', 0.7);

    g.selectAll('path.country')
      .data(mapData.countries.features)
      .enter().append('path')
      .attr('class', 'country')
      .attr('d', pathGenerator as any)
      .attr('vector-effect', 'non-scaling-stroke')
      .attr('fill', '#d3d3d3')
      .attr('stroke', 'black')
      .attr('stroke-width', 0.15)
      .style('cursor', 'pointer')
      .each(function (d: any) {
        countryPathsRef.current.set(d.properties.name, this);
      });

    g.selectAll('path.territory')
      .data(mapData.land.features.filter((f: any) => TERRITORIES.has(f.properties?.name)))
      .enter().append('path')
      .attr('d', pathGenerator as any)
      .attr('fill', '#808080')
      .attr('stroke', 'black')
      .attr('stroke-width', 0.5)
      .attr('vector-effect', 'non-scaling-stroke');

  }, [mapData, dimensions]);


  // 4. GAME UPDATES - UPDATED FOR DUAL MODES
  useEffect(() => {
    if (!mapData || !gRef.current || !gFixedRef.current || !pathGeneratorRef.current) return;
    const pathGenerator = pathGeneratorRef.current;

    // A. Update Colors and Display
    countryPathsRef.current.forEach((path, countryName) => {
      const mappedName = TERRITORY_NAME_MAP[countryName] || countryName;
      let fillColor = '#d3d3d3';
      let display = 'block';
      
      if (mode === 'classic') {
        if (!validCountries.includes(mappedName)) {
          fillColor = '#808080';
        } else if (revealedCountries.includes(mappedName)) {
          fillColor = '#ef4444';
        } else if (guessedCountries[mappedName]) {
          fillColor = '#34D399';
        }
      } else {
        // NEIGHBORS MODE COLORS AND VISIBILITY
        const isTarget = mappedName === targetCountry;
        const isNeighbor = foundNeighbors.includes(mappedName);
        const isRevealed = revealedByGiveUp.includes(mappedName);
        
        // Hide all countries except target and neighbors
        if (!isTarget && !isNeighbor && !isRevealed) {
          display = 'none';
        }
        
        if (isTarget) {
          fillColor = '#FBBF24'; // Gold/Yellow
        } else if (isNeighbor) {
          fillColor = '#34D399'; // Green
        } else if (isRevealed) {
          fillColor = '#ef4444'; // Red for revealed by give up
        } else {
          fillColor = '#d3d3d3'; // Default Grey (hidden anyway)
        }
      }
      
      d3.select(path).attr('fill', fillColor).style('display', display);
    });

    // B. Update Dots (Only for Classic Mode or specific needs)
    // We only show red dots in classic mode for missing countries
    const dotsData = mode === 'classic' 
      ? mapData.countries.features.filter((f: any) => {
          const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
          return validCountries.includes(mappedName) && !guessedCountries[mappedName];
        })
      : []; // No dots in neighbor mode to keep it clean

    const dots = gFixedRef.current.selectAll<SVGCircleElement, any>('circle.country-dot')
      .data(dotsData, (d: any) => d.properties.name);

    dots.exit().remove();
    dots.enter().append('circle')
      .attr('class', 'country-dot')
      .attr('r', 4 / currentScaleRef.current)
      .attr('fill', '#ef4444')
      .attr('pointer-events', 'none')
      .merge(dots)
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
      });

    // C. Update Labels
    const labelsData = mapData.countries.features.filter((f: any) => {
      const mappedName = TERRITORY_NAME_MAP[f.properties.name] || f.properties.name;
      
      if (mode === 'classic') {
        return guessedCountries[mappedName] || revealedCountries.includes(mappedName);
      } else {
        // NEIGHBORS MODE LABELS
        if (mappedName === targetCountry) {
          return !isHardMode; // Hide target name in Hard Mode
        }
        if (foundNeighbors.includes(mappedName)) return true;
        if (revealedByGiveUp.includes(mappedName)) return true; // Show labels for revealed neighbors
        return false;
      }
    });

    const labels = gFixedRef.current.selectAll<SVGTextElement, any>('text.country-label')
      .data(labelsData, (d: any) => d.properties.name);

    labels.exit().remove();
    labels.enter().append('text')
      .attr('class', 'country-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .merge(labels)
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
      .attr('fill', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        // Logic for Label Color
        if (mode === 'classic') {
          return revealedCountries.includes(mappedName) ? '#ff4444' : '#ffffff';
        } else {
          // Neighbors: Target is black on gold, others white on green, red for revealed
          if (mappedName === targetCountry) return '#000000';
          if (revealedByGiveUp.includes(mappedName)) return '#ef4444'; // Red for revealed
          return '#ffffff';
        }
      })
      .attr('stroke', (d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        if (mode === 'classic') {
           return revealedCountries.includes(mappedName) ? '#660000' : '#000000';
        } else {
           if (mappedName === targetCountry) return 'rgba(255,255,255,0.5)'; // Slight halo for target
           if (revealedByGiveUp.includes(mappedName)) return 'rgba(0,0,0,0.3)'; // Dark outline for red text
           return '#000000';
        }
      })
      .attr('stroke-width', `${0.2 / currentScaleRef.current}rem`)
      .style('paint-order', 'stroke fill')
      .attr('font-size', `${0.7 / currentScaleRef.current}rem`)
      .text((d: any) => {
        const mappedName = TERRITORY_NAME_MAP[d.properties.name] || d.properties.name;
        return mappedName;
      })
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)');

  }, [
    mode, 
    guessedCountries, 
    validCountries, 
    revealedCountries, 
    mapData, 
    // Neighbors dependencies
    targetCountry,
    foundNeighbors,
    isHardMode,
    gameStatus,
    revealedByGiveUp
  ]);


  // 5. Focus/Zoom Effect (Updated to handle Target Country in Neighbors Mode)
  useEffect(() => {
    // Determine what to focus on
    let focusTarget = focusedCountry;
    
    // Auto-focus on target country in neighbors mode
    if (mode === 'neighbors' && targetCountry) {
        focusTarget = targetCountry;
    }

    if (!focusTarget || !mapData || !svgRef.current || !zoomRef.current || !projectionRef.current) return;

    const feature = mapData.countries.features.find((f: any) => {
      const name = f.properties.name;
      const mappedName = TERRITORY_NAME_MAP[name] || name;
      return mappedName === focusTarget;
    });

    if (!feature) return;

    const pathGenerator = d3.geoPath().projection(projectionRef.current);
    let centerX, centerY;
    try {
      const centroid = pathGenerator.centroid(feature);
      centerX = centroid[0];
      centerY = centroid[1];
    } catch (e) {
      const bounds = pathGenerator.bounds(feature);
      centerX = (bounds[0][0] + bounds[1][0]) / 2;
      centerY = (bounds[0][1] + bounds[1][1]) / 2;
    }
    
    const adjustment = POSITION_ADJUSTMENTS[focusTarget] || [0, 0];
    centerX += adjustment[0];
    centerY += adjustment[1];

    const bounds = pathGenerator.bounds(feature);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const { width, height } = dimensions;

    const area = dx * dy;
    let paddingFactor = 0.4;
    if (area < 0.5) paddingFactor = 0.02;
    else if (area < 5) paddingFactor = 0.1;

    const autoScale = paddingFactor / Math.max(dx / width, dy / height);
    const targetScale = Math.max(1.5, Math.min(60, autoScale));

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
  }, [focusedCountry, targetCountry, mode, mapData, dimensions]);

  // ... (Keep Zoom Buttons and Hover Effect identical) ...
  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  };
  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  };
  const handleResetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity.scale(0.8));
  };

  useEffect(() => {
    d3.selectAll('.country').classed('list-hovered', false);
    if (!hoveredCountry) return;
    d3.selectAll('.country').filter((d: any) => {
      const name = d.properties.name;
      const mappedName = TERRITORY_NAME_MAP[name] || name;
      return mappedName === hoveredCountry;
    }).classed('list-hovered', true);
  }, [hoveredCountry]);

  return (
    <div className="map-wrapper">
      <svg 
        ref={svgRef} 
        className="world-map"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div className="zoom-controls">
        <button onClick={handleZoomIn} className="zoom-btn zoom-in">+</button>
        <button onClick={handleResetZoom} className="zoom-btn zoom-reset">↺</button>
        <button onClick={handleZoomOut} className="zoom-btn zoom-out">−</button>
      </div>
    </div>
  );
};

export default WorldMap;