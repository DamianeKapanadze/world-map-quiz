import { useState, useRef, useMemo, useEffect } from 'react';
import * as d3 from 'd3'; // Needed for loading data for neighbor calculation
import './App.css';
import WorldMap from './WorldMap';
import { buildAdjacencyList } from './mapHelpers';
import { useNeighborGame } from './useNeighborGame';

interface GuessedCountries {
  [countryName: string]: boolean;
}

function App() {
  // --- GLOBAL STATE ---
  const [mode, setMode] = useState<'classic' | 'neighbors'>('classic');
  const [mapData, setMapData] = useState<any>(null); // Shared map data
  const [neighborMap, setNeighborMap] = useState<Map<string, string[]>>(new Map());

  // --- CLASSIC GAME STATE ---
  const [guessedCountries, setGuessedCountries] = useState<GuessedCountries>({});
  const [guessedOrder, setGuessedOrder] = useState<string[]>([]);
  const [revealedCountries, setRevealedCountries] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  
  // --- NEIGHBORS GAME STATE (via Hook) ---
  const neighborGame = useNeighborGame(neighborMap);
  const [revealedByGiveUp, setRevealedByGiveUp] = useState<string[]>([]);
  const [gaveUpThisRound, setGaveUpThisRound] = useState(false);

  // --- UI STATE ---
  const [showMapDataTooltip, setShowMapDataTooltip] = useState(false);
  const [focusedCountry, setFocusedCountry] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const mapDataTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // List of all valid countries (197 countries)
  const allCountries = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
    'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas',
    'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
    'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cambodia', 'Canada',
    'Cabo Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
    'Comoros', 'Republic of the Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
    'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt',
    'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
    'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
    'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti',
    'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
    'Israel', 'Italy', 'Côte d\'Ivoire', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
    'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
    'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania',
    'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
    'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands',
    'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia',
    'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea',
    'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
    'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',    'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
    'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
    'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
    'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
    'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
    'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
  ];

  // 1. DATA LOADING EFFECT (Runs Once)
  useEffect(() => {
    // We load the 50m data here to calculate neighbors
    d3.json('https://unpkg.com/world-atlas@2.0.2/countries-50m.json').then((data: any) => {
      setMapData(data); // Store it so we can pass to WorldMap (optional optimization)
      
      // Calculate Neighbors
      const adjacency = buildAdjacencyList(data);
      setNeighborMap(adjacency);
    }).catch(err => console.error("Failed to load map data", err));
  }, []);


  // Normalize input: remove spaces and dashes, lowercase
  const normalizeInput = (str: string): string => {
    return str.trim().toLowerCase().replace(/[\s-]/g, '');
  };

  // Create normalized lookup map
  const countryAliases: { [key: string]: string } = useMemo(() => {
    const aliases: { [key: string]: string } = {};
    
    allCountries.forEach(country => {
      // Add normalized version
      aliases[normalizeInput(country)] = country;
      
      // Add common abbreviations (kept your existing list)
      if (country === 'United States of America') { aliases['usa'] = country; aliases['america'] = country; }
      if (country === 'United Arab Emirates') { aliases['uae'] = country; aliases['emirates'] = country; }
      if (country === 'Czech Republic') { aliases['czechia'] = country; }
      if (country === 'North Macedonia') { aliases['macedonia'] = country; }
      if (country === 'Saint Kitts and Nevis') { aliases['stkittsandnevis'] = country; }
      if (country === 'Saint Lucia') { aliases['stlucia'] = country; }
      if (country === 'Saint Vincent and the Grenadines') { aliases['stvincentandthegrenadines'] = country; }
      if (country === 'Central African Republic') { aliases['car'] = country; }
      if (country === 'Republic of the Congo') { aliases['republicofcongo'] = country; aliases['congo'] = country; }
      if (country === 'Democratic Republic of the Congo') { aliases['drc'] = country; aliases['congkinshasa'] = country; }
      if (country === 'United Kingdom') { aliases['uk'] = country; aliases['britain'] = country; aliases['greatbritain'] = country; }
      if (country === 'South Korea') { aliases['korea'] = country; }
      if (country === 'Ivory Coast') { aliases['cotedivoire'] = country; aliases['ivorycoast'] = country; }
      if (country === 'Côte d\'Ivoire') { aliases['cotedivoire'] = country; aliases['ivorycoast'] = country; }
      if (country === 'Vatican City') { aliases['vatican'] = country; aliases['holysee'] = country; }
    });
    
    return aliases;
  }, []);

  const resolveCountry = (input: string): string | null => {
    const normalized = normalizeInput(input);
    return countryAliases[normalized] || null;
  };

  // --- UNIFIED INPUT HANDLER ---
  const handleInputChange = (value: string) => {
    setInput(value);
    
    const resolved = resolveCountry(value);
    if (!resolved) return;

    if (mode === 'classic') {
      // CLASSIC LOGIC
      if (!guessedCountries[resolved]) {
        setGuessedCountries(prev => ({ ...prev, [resolved]: true }));
        setGuessedOrder(prev => [...prev, resolved]);
        setInput('');
        inputRef.current?.focus();
      }
    } else {
      // NEIGHBORS LOGIC
      neighborGame.checkGuess(resolved);
      // We clear input if it's a valid country, regardless if it's the correct neighbor
      setInput('');
      inputRef.current?.focus();
    }
  };

  const guessCount = Object.values(guessedCountries).filter(Boolean).length;
  const isGameComplete = guessCount === allCountries.length;

  // Timer effect - only runs when CLASSIC game started and not complete
  useEffect(() => {
    if (mode !== 'classic' || !gameStarted || isGameComplete || revealedCountries.length > 0) return;
    
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, isGameComplete, revealedCountries.length, mode]);

  const handleStartGame = () => {
    setGuessedCountries({});
    setGuessedOrder([]);
    setRevealedCountries([]);
    setInput('');
    setSeconds(0);
    setGameStarted(true);
    setGameEnded(false);
    inputRef.current?.focus();
  };

  const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGiveUp = () => {
    const remaining = allCountries.filter(country => !guessedCountries[country]);
    setRevealedCountries(remaining);
    setGuessedOrder(prev => [...prev, ...remaining]);
    const newGuessed = { ...guessedCountries };
    remaining.forEach(country => {
      newGuessed[country] = true;
    });
    setGuessedCountries(newGuessed);
    setGameEnded(true);
  };

  return (
    <div className="App">
      <div className="app-header">
        <h1>Guess the <span>{mode === 'classic' ? 'Countries' : 'Neighbors'}</span></h1>
        <button 
          className="mode-toggle-btn" 
          onClick={() => { setMode(mode === 'classic' ? 'neighbors' : 'classic'); setInput(''); }}
        >
          {mode === 'classic' ? 'Neighbors Mode' : 'Classic Mode'}
        </button>
      </div>
      
      <div className="main-content">
        <div className="map-container" onClick={() => inputRef.current?.focus()}>
          <WorldMap 
            // Shared Props
            rawMapData={mapData}
            mode={mode}
            focusedCountry={focusedCountry} 
            hoveredCountry={hoveredCountry}
            validCountries={allCountries}
            
            // Classic Props
            guessedCountries={guessedCountries} 
            revealedCountries={revealedCountries} 
            
            // Neighbor Props
            targetCountry={neighborGame.targetCountry}
            foundNeighbors={neighborGame.foundNeighbors}
            isHardMode={neighborGame.isHardMode}
            gameStatus={neighborGame.gameStatus}
            revealedByGiveUp={revealedByGiveUp}
          />
        </div>
        
        <div className="debug-panel">
          {mode === 'classic' ? (
            // --- CLASSIC SIDEBAR ---
            <>
              <h3>Guessed ({guessCount}/{allCountries.length})</h3>
              <p className="timer">Time: {formatTime(seconds)}</p>
              <div className="countries-list">
                {guessedOrder.map((country, index) => (
                  <div 
                    key={country} 
                    className="country-item learning-item"
                    onClick={() => setFocusedCountry(country)}
                    onMouseEnter={() => setHoveredCountry(country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    style={{
                      color: revealedCountries.includes(country) ? '#ef4444' : 'inherit',
                      fontWeight: revealedCountries.includes(country) ? 'bold' : 'normal'
                    }}
                  >
                    {index + 1}. {country}
                  </div>
                ))}
              </div>
            </>
          ) : (
            // --- NEIGHBORS SIDEBAR ---
            <>
              <h3>Neighbors Mode</h3>
              {neighborGame.targetCountry ? (
                <div className="neighbor-stats">
                   <div className="target-card">
                      <span className="label">Target Country:</span>
                      <h2 className="target-name">
                        {neighborGame.isHardMode ? "???" : neighborGame.targetCountry}
                      </h2>
                   </div>

                   <div className="progress-card">
                      <span className="label">Progress:</span>
                      <div className="score-big">
                        {neighborGame.foundNeighbors.length} 
                        <span className="total"> / {neighborMap.get(neighborGame.targetCountry)?.length || '?'}</span>
                      </div>
                   </div>

                   {neighborGame.gameStatus === 'won' && (
                     <div className="win-message">
                       🎉 All Neighbors Found!
                     </div>
                   )}
                </div>
              ) : (
                <p className="empty-state">Start a round to play.</p>
              )}

              {/* Found Neighbors List */}
              {neighborGame.foundNeighbors.length > 0 && (
                <div className="found-section">
                   <h4>Found Neighbors</h4>
                   <div className="found-list">
                     {neighborGame.foundNeighbors.map((c: string) => (
                       <span key={c} className="found-item">{c}</span>
                     ))}
                   </div>
                </div>
              )}

              {/* Remaining Neighbors List */}
              {gaveUpThisRound && neighborGame.targetCountry && neighborGame.gameStatus !== 'won' && (
                (() => {
                  const allNeighbors = neighborMap.get(neighborGame.targetCountry) || [];
                  const unrevealed = allNeighbors.filter(n => !neighborGame.foundNeighbors.includes(n) && !revealedByGiveUp.includes(n));
                  const allRemaining = [...unrevealed, ...revealedByGiveUp];
                  return allRemaining.length > 0 ? (
                    <div className="remaining-section">
                       <h4>Remaining Neighbors</h4>
                       <div className="remaining-list">
                         {unrevealed.map((c: string) => (
                           <span key={c} className="remaining-item">{c}</span>
                         ))}
                         {revealedByGiveUp.map((c: string) => (
                           <span key={c} className="revealed-item">{c}</span>
                         ))}
                       </div>
                    </div>
                  ) : null;
                })()
              )}

              {/* Incorrect Guesses List */}
              {neighborGame.missedGuesses.length > 0 && (
                <div className="missed-section">
                   <h4>Missed Guesses</h4>
                   <div className="missed-list">
                     {neighborGame.missedGuesses.map((c: string) => (
                       <span key={c} className="missed-item">{c}</span>
                     ))}
                   </div>
                </div>
              )}
            </>
          )}

          {guessCount === 0 && mode === 'classic' && (
            <p className="empty-state">Start guessing countries...</p>
          )}
        </div>
      </div>

      <div className="game-controls">
        <div className="controls-left">
          {/* Map Data Info - Kept from original */}
          <span 
            className="disclaimer-wrapper"
            onMouseEnter={() => {
              if (mapDataTimeoutRef.current) clearTimeout(mapDataTimeoutRef.current);
              setShowMapDataTooltip(true);
            }}
            onMouseLeave={() => {
              mapDataTimeoutRef.current = setTimeout(() => setShowMapDataTooltip(false), 250);
            }}
          >
            <span>Map Data</span>
            <span className="info-icon">i</span>
            <span className="tooltip-text" style={{ visibility: showMapDataTooltip ? 'visible' : 'hidden', opacity: showMapDataTooltip ? 1 : 0 }}>
              Based on the standard 197 sovereign states.
            </span>
          </span>
        </div>

        <div className="controls-main">
          {mode === 'classic' ? (
            // --- CLASSIC CONTROLS ---
            <>
              {!gameStarted ? (
                <button className="start-btn" onClick={handleStartGame}>Start Game</button>
              ) : gameEnded ? (
                <button className="start-btn" onClick={handleStartGame}>Start New Game</button>
              ) : (
                <>
                  <input 
                    ref={inputRef}
                    type="text" 
                    placeholder="Enter a country..." 
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    autoFocus
                  />
                  <button className="give-up-btn" onClick={handleGiveUp}>Give Up</button>
                </>
              )}
              <div className="guess-counter">({guessCount}/{allCountries.length})</div>
            </>
          ) : (
            // --- NEIGHBORS CONTROLS ---
            <>
              <button className="start-btn" onClick={() => {
                 neighborGame.startNewRound();
                 setRevealedByGiveUp([]);
                 setGaveUpThisRound(false);
                 setInput('');
                 inputRef.current?.focus();
              }}>
                {neighborGame.gameStatus === 'idle' ? 'Start Game' : 'Skip / Next'}
              </button>

              <input 
                 ref={inputRef}
                 type="text" 
                 placeholder="Name a neighbor..." 
                 value={input}
                 disabled={neighborGame.gameStatus === 'idle'}
                 onChange={(e) => handleInputChange(e.target.value)}
                 autoFocus
              />

              <button 
                className={`hard-mode-btn ${neighborGame.isHardMode ? 'active' : ''}`}
                onClick={neighborGame.toggleHardMode}
              >
                Hard Mode
              </button>

              {neighborGame.gameStatus !== 'idle' && (
                <button className="give-up-btn" onClick={() => {
                  const allNeighbors = Array.from(neighborMap.get(neighborGame.targetCountry || '') || []);
                  const unrevealed = allNeighbors.filter(n => !neighborGame.foundNeighbors.includes(n));
                  setRevealedByGiveUp(unrevealed);
                  setGaveUpThisRound(true);
                  setInput('');
                  inputRef.current?.focus();
                }}>
                  Give Up
                </button>
              )}
            </>
          )}
        </div>

        <div className="credits-wrapper">
          {/* ... Credits (Kept same as original) ... */}
           <button 
            className="credits-toggle"
          >
            Credits
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;