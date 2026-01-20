# AI Coding Instructions for my-geo-game-V2

## Project Overview
**my-geo-game-V2** is a geography trivia game built with React, TypeScript, D3.js, and Vite. The game has two modes:
- **Guess Mode**: Players type country/territory names to identify them on the map; correct guesses turn regions green with labels
- **Explore Mode**: Players browse regions and countries; highlighted country zooms to center with smart zoom adjustments for large/dispersed regions

## Architecture

### Core Components

**App.tsx** (main game logic):
- Manages `guessedCountries` state (boolean lookup by country name)
- Defines canonical country list (197 countries) and territories list (12 territories)
- Implements normalization logic: `normalizeInput()` strips spaces/dashes, lowercases
- Country resolution via `countryAliases` map supporting abbreviations (USA→United States of America, DRC→Democratic Republic of the Congo, UK→United Kingdom)
- Regional grouping in `countriesByRegion` (9 regions) for Explore Mode display
- Toggles between modes via `setExploreMode()`

**WorldMap.tsx** (D3 visualization):
- Uses `d3.geoEquirectangular()` projection fitted to countries GeoJSON
- Two SVG groups: `g` (main zooming group) and `gFixed` (scaled inverse for readable dots/labels at any zoom)
- **Dots layer**: Red circles show unguessed countries (centroid-based positioning, radius scales with zoom: `4 / scale`)
- **Labels layer**: Black text shows guessed country names with white text-shadow
- **Territory layer**: Static gray regions (Greenland, Antarctica, etc.)
- Zoom behavior: `scaleExtent([0.1, Infinity])`, default 80% scale via `d3.zoomIdentity.scale(0.8)`
- Smart zoom on country selection: applies `ZOOM_ADJUSTMENTS` (e.g., 1.5x for New Zealand, USA; 1.3x for large regions like Russia, Canada)
- Uses `vector-effect="non-scaling-stroke"` to keep borders crisp during zoom

### Name Mapping Layer
**TERRITORY_NAME_MAP** in WorldMap.tsx maps world-atlas TopoJSON names to game names (e.g., 'Czechia'→'Czech Republic', 'W. Sahara'→'Western Sahara'). This bridges the gap between data source naming and canonical country list.

### Data Flow
1. **Load**: D3 fetches `world-atlas@2.0.2/countries-50m.json` (TopoJSON format)
2. **Parse**: `topojson.feature()` converts to GeoJSON FeatureCollections
3. **Normalize**: Names mapped via `TERRITORY_NAME_MAP`, stored in state
4. **Render**: D3 path generator creates SVG elements, centroid calculated for dots/labels
5. **Update**: Guess validates against aliases, updates `guessedCountries`, triggers re-render

## Key Patterns

### State Management
- `guessedCountries`: Simple object for O(1) lookup (`[countryName]: boolean`)
- `exploreMode`, `highlightedCountry`: Toggle states for mode switching
- `currentScaleRef` (ref, not state): Tracks zoom scale to avoid re-renders

### D3 Patterns
- **Refs for D3 selections**: `gRef`, `gFixedRef`, `projectionRef`, `zoomRef` preserve D3 objects across renders
- **Centroid-based positioning**: All text/dot placement uses `pathGenerator.centroid(feature)` for center of mass
- **Inverse scaling on gFixed**: Instead of scaling SVG elements, modify `r` and `font-size` attributes (`4 / scale`, `0.7 / scale`)
- **Data binding**: Use `(d: any) => d.properties.name` as key function to track elements by country name

### Input Handling
- Real-time validation on keypress (not on form submit)
- Guess auto-clears input and re-focuses after success
- Normalization critical: "Democratic Republic of the Congo", "DRC", "drc", "congo" all resolve via aliases

### Responsive Design
- Viewport dimensions tracked via `window.addEventListener('resize')`
- SVG resizes via `.attr('width', width).attr('height', height)`
- Projection re-fitted on dimension change

## Development

### Build & Run
```bash
npm install                    # Install D3, React, TypeScript, Vite
npm run dev                   # Start Vite dev server with HMR
npm run build                 # Compile TypeScript, build production bundle
npm run lint                  # Run ESLint
npm run preview               # Preview production build locally
```

### Testing Strategy
- Manual testing via `npm run dev`: verify guess logic, mode toggling, zoom animation
- Visual inspection of map rendering, dot/label placement at multiple zoom levels
- Edge cases: countries with special characters (Côte d'Ivoire, São Tomé and Príncipe), multi-word names, abbreviations

## Common Tasks

### Adding a New Country
1. Add to `allCountries` array in App.tsx
2. If TopoJSON uses different name, add mapping to `TERRITORY_NAME_MAP` in WorldMap.tsx
3. If country needs custom zoom level, add to `ZOOM_ADJUSTMENTS` in WorldMap.tsx
4. If common abbreviation, add alias to `countryAliases` object in App.tsx

### Modifying Map Styling
- Country fill colors: `.attr('fill', condition ? '#34D399' : '#d3d3d3')`
- Stroke widths use `vector-effect="non-scaling-stroke"` to remain constant during zoom
- Text colors/shadows: modify `.attr('fill', '#000000')` and `.style('text-shadow', '...')`

### Debugging D3 Layout
- `currentScaleRef.current` holds current zoom level (logs at zoom events)
- `countryPathsRef.current` maps country names to SVG path elements for inspection
- Centroid calculations can be logged: `pathGenerator.centroid(feature)` returns `[x, y]`

## File Structure
```
src/
  App.tsx            # Game logic, state, country lists, mode toggle
  WorldMap.tsx       # D3 map, projections, zoom, layers
  App.css            # Layout, controls, countries list
  WorldMap.css       # Map styles, zoom button styles
  main.tsx           # React root
public/              # Static assets (empty)
vite.config.ts       # Vite + React plugin config
```

## Dependencies
- **d3** (7.9.0): Geo projections, path generation, zoom behavior, transitions
- **topojson-client** (3.1.0): Converts TopoJSON to GeoJSON
- **react** (19.2.0), **react-dom** (19.2.0): UI framework
- **typescript** (~5.9.3): Type safety
- **vite** (7.2.4): Build tool with React fast refresh

## External Data
- **world-atlas@2.0.2**: Countries and land boundaries as TopoJSON (CDN-fetched, no npm install needed)
