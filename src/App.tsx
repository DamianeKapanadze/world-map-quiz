import { useState, useRef, useMemo, useEffect } from 'react';
import './App.css';
import WorldMap from './WorldMap';

interface GuessedCountries {
  [countryName: string]: boolean;
}

function App() {
  const [guessedCountries, setGuessedCountries] = useState<GuessedCountries>({});
  const [guessedOrder, setGuessedOrder] = useState<string[]>([]);
  const [revealedCountries, setRevealedCountries] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // List of all valid countries (197 countries)
  const allCountries = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
    'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas',
    'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
    'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cambodia', 'Canada',
    'Cabo Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia',
    'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
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
    'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
    'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
    'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
    'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan',
    'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
    'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
    'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
  ];

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
      
      // Add common abbreviations and alternate names
      if (country === 'United States of America') {
        aliases['usa'] = country;
        aliases['america'] = country;
      }
      if (country === 'Democratic Republic of the Congo') {
        aliases['drc'] = country;
        aliases['congkinshasa'] = country;
      }
      if (country === 'United Kingdom') {
        aliases['uk'] = country;
        aliases['britain'] = country;
        aliases['greatbritain'] = country;
      }
      if (country === 'South Korea') {
        aliases['korea'] = country;
      }
      if (country === 'Ivory Coast') {
        aliases['cotedivoire'] = country;
        aliases['ivorycoast'] = country;
      }
      if (country === 'Côte d\'Ivoire') {
        aliases['cotedivoire'] = country;
        aliases['ivorycoast'] = country;
      }
      if (country === 'Vatican City') {
        aliases['vatican'] = country;
        aliases['holysee'] = country;
      }
    });
    
    return aliases;
  }, []);

  const resolveCountry = (input: string): string | null => {
    const normalized = normalizeInput(input);
    return countryAliases[normalized] || null;
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    
    // Real-time checking
    const resolved = resolveCountry(value);
    if (resolved && !guessedCountries[resolved]) {
      setGuessedCountries(prev => ({
        ...prev,
        [resolved]: true
      }));
      setGuessedOrder(prev => [...prev, resolved]);
      setInput('');
      inputRef.current?.focus();
    }
  };

  const guessCount = Object.values(guessedCountries).filter(Boolean).length;
  const isGameComplete = guessCount === allCountries.length;

  // Timer effect - only runs when game started and not complete
  useEffect(() => {
    if (!gameStarted || isGameComplete || revealedCountries.length > 0) return;
    
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, isGameComplete, revealedCountries.length]);

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
      <h1>Guess the <span>Countries</span></h1>
      
      <div className="main-content">
        <div className="map-container" onClick={() => inputRef.current?.focus()}>
          <WorldMap guessedCountries={guessedCountries} validCountries={allCountries} revealedCountries={revealedCountries} />
        </div>
        
        <div className="debug-panel">
          <h3>Guessed ({guessCount}/{allCountries.length})</h3>
          <p className="timer">Time: {formatTime(seconds)}</p>
          <div className="countries-list">
            {guessedOrder.map((country, index) => (
              <div 
                key={country} 
                className="country-item"
                style={{
                  color: revealedCountries.includes(country) ? '#ef4444' : 'inherit',
                  fontWeight: revealedCountries.includes(country) ? 'bold' : 'normal'
                }}
              >
                {index + 1}. {country}
              </div>
            ))}
          </div>
          {guessCount === 0 && (
            <p className="empty-state">Start guessing countries...</p>
          )}
        </div>
      </div>

      <div className="game-controls">
        {!gameStarted ? (
          <button 
            className="start-btn"
            onClick={handleStartGame}
            title="Start the game"
          >
            Start Game
          </button>
        ) : gameEnded ? (
          <button 
            className="start-btn"
            onClick={handleStartGame}
            title="Start a new game"
          >
            Start New Game
          </button>
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
            <button 
              className="give-up-btn"
              onClick={handleGiveUp}
              title="Reveal all remaining countries"
            >
              Give Up
            </button>
          </>
        )}
        <div className="guess-counter">({guessCount}/{allCountries.length})</div>
      </div>

      <footer className="footer">
        <button 
          className="credits-toggle"
          onClick={() => setShowCredits(!showCredits)}
          title="View credits"
        >
          Credits
        </button>
        
        {showCredits && (
          <div className="credits-content">
            <p className="credits-section">
              <strong>Inspiration:</strong>
              <a href="https://travle.earth/" target="_blank" rel="noopener noreferrer">Travle.earth</a>
              <a href="https://www.sporcle.com/games/g/world" target="_blank" rel="noopener noreferrer">Sporcle World Geography</a>
            </p>
            
            <p className="credits-section">
              <strong>Tutorials:</strong>
              <a href="https://www.youtube.com/watch?v=9ZB1EgaJnBU" target="_blank" rel="noopener noreferrer">Curran Kelleher - D3.js</a>
            </p>
            
            <p className="credits-section">
              <strong>Built with:</strong>
              <a href="https://d3js.org" target="_blank" rel="noopener noreferrer">D3.js</a>
              <a href="https://react.dev" target="_blank" rel="noopener noreferrer">React</a>
              <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">Vite</a>
              <a href="https://github.com/topojson/world-atlas" target="_blank" rel="noopener noreferrer">world-atlas</a>
            </p>
            
            <p className="credits-section">
              <strong>AI Assistance:</strong>
              Gemini • GitHub Copilot
            </p>
            
            <p className="credits-section">
              <strong>Creator:</strong>
              Damiane Kapanadze •
              <a href="https://lowinertia.com/portfolio/damiane" target="_blank" rel="noopener noreferrer">Portfolio</a>
              <a href="https://www.linkedin.com/in/damianekapanadze/" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            </p>
          </div>
        )}
      </footer>
    </div>
  );
}

export default App;