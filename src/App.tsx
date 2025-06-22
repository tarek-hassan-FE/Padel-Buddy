import { useState } from 'react'

interface Player {
  name: string;
  gamesPlayed: number;
}

interface Match {
  courts: string[][];
  resting: string[];
}

interface Schedule {
  rounds: Match[];
}

type CourtWinner = 1 | 2 | null; // 1 = Team 1, 2 = Team 2

function App() {
  const [players, setPlayers] = useState<string[]>([]);
  const [playerInput, setPlayerInput] = useState('');
  const [courts, setCourts] = useState(2);
  const [duration, setDuration] = useState(2); // in hours
  const [roundDuration, setRoundDuration] = useState(15); // in minutes
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState('');
  // winners[round][court] = CourtWinner
  const [winners, setWinners] = useState<CourtWinner[][]>([]);
  const [numRounds, setNumRounds] = useState(0);

  // Shuffle array function
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Parse player names from input
  const parsePlayers = (input: string): string[] => {
    return input
      .split(/[,\n]/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
  };

  // Calculate number of rounds based on duration and round duration
  const calculateRounds = (durationHours: number, roundDuration: number, courts: number) => {
    let rounds = Math.floor((durationHours * 60) / roundDuration);
    // Make rounds a multiple of courts for fairness
    rounds = Math.floor(rounds / courts) * courts;
    if (rounds < courts) rounds = courts; // at least one round per court
    return rounds;
  };

  // Validate player input
  const validatePlayers = (playerNames: string[], courts: number): string | null => {
    if (playerNames.length < 4) {
      return `Please enter at least 4 players. You entered ${playerNames.length}.`;
    }
    if (courts < 1) {
      return 'There must be at least 1 court.';
    }
    if (playerNames.length < courts * 4) {
      return `You need at least ${courts * 4} players for ${courts} courts (4 per court).`;
    }
    if (courts > Math.floor(playerNames.length / 4)) {
      return `Too many courts for the number of players. Max courts: ${Math.floor(playerNames.length / 4)}`;
    }
    const uniqueNames = new Set(playerNames);
    if (uniqueNames.size !== playerNames.length) {
      return 'Please ensure all player names are unique.';
    }
    return null;
  };

  // Generate schedule
  const generateSchedule = (playerNames: string[], courts: number, rounds: number): Schedule => {
    const roundsArr: Match[] = [];
    const playerStats: { [key: string]: number } = {};
    playerNames.forEach(name => {
      playerStats[name] = 0;
    });
    for (let round = 0; round < rounds; round++) {
      // Sort by games played for fairness
      const sortedPlayers = [...playerNames].sort((a, b) => playerStats[a] - playerStats[b]);
      // Pick courts*4 to play, rest sit out
      const selectedPlayers = sortedPlayers.slice(0, courts * 4);
      const restingPlayers = sortedPlayers.slice(courts * 4);
      const shuffledSelected = shuffleArray(selectedPlayers);
      // Assign players to courts
      const courtAssignments: string[][] = [];
      for (let c = 0; c < courts; c++) {
        courtAssignments.push(shuffledSelected.slice(c * 4, (c + 1) * 4));
      }
      selectedPlayers.forEach(player => {
        playerStats[player]++;
      });
      roundsArr.push({ courts: courtAssignments, resting: restingPlayers });
    }
    return { rounds: roundsArr };
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const playerNames = parsePlayers(playerInput);
    const validationError = validatePlayers(playerNames, courts);
    if (validationError) {
      setError(validationError);
      return;
    }
    // Calculate number of rounds
    const rounds = calculateRounds(duration, roundDuration, courts);
    setNumRounds(rounds);
    setPlayers(playerNames);
    const newSchedule = generateSchedule(playerNames, courts, rounds);
    setSchedule(newSchedule);
    setWinners(Array(rounds).fill(null).map(() => Array(courts).fill(null))); // Reset winners
  };

  // Regenerate schedule
  const handleRegenerate = () => {
    if (players.length >= courts * 4) {
      const rounds = calculateRounds(duration, roundDuration, courts);
      setNumRounds(rounds);
      const newSchedule = generateSchedule(players, courts, rounds);
      setSchedule(newSchedule);
      setWinners(Array(rounds).fill(null).map(() => Array(courts).fill(null))); // Reset winners
    }
  };

  // Calculate games played per player
  const getPlayerStats = (): { [key: string]: number } => {
    if (!schedule) return {};
    const stats: { [key: string]: number } = {};
    players.forEach(player => {
      stats[player] = 0;
    });
    schedule.rounds.forEach(round => {
      round.courts.flat().forEach(player => {
        stats[player]++;
      });
    });
    return stats;
  };

  // Calculate wins per player
  const getPlayerWins = (): { [key: string]: number } => {
    if (!schedule) return {};
    const wins: { [key: string]: number } = {};
    players.forEach(player => {
      wins[player] = 0;
    });
    winners.forEach((roundWinners, roundIdx) => {
      if (!schedule.rounds[roundIdx]) return;
      roundWinners.forEach((winner, courtIdx) => {
        if (!schedule.rounds[roundIdx].courts[courtIdx]) return;
        if (winner === 1) {
          // Team 1 wins (first 2 players)
          schedule.rounds[roundIdx].courts[courtIdx].slice(0, 2).forEach(player => {
            wins[player]++;
          });
        } else if (winner === 2) {
          // Team 2 wins (last 2 players)
          schedule.rounds[roundIdx].courts[courtIdx].slice(2, 4).forEach(player => {
            wins[player]++;
          });
        }
      });
    });
    return wins;
  };

  // Leaderboard sorted by most wins
  const getLeaderboard = () => {
    const wins = getPlayerWins();
    return Object.entries(wins).sort((a, b) => b[1] - a[1]);
  };

  // Set winner for a court in a round
  const setCourtWinner = (roundIdx: number, courtIdx: number, winner: CourtWinner) => {
    setWinners(prev => {
      const updated = prev.map(arr => [...arr]);
      updated[roundIdx][courtIdx] = winner;
      return updated;
    });
  };

  // Max courts for current player input
  const maxCourts = Math.max(1, Math.floor(parsePlayers(playerInput).length / 4));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6">
            <span className="text-3xl">🏓</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Padel Match Scheduler
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Generate fair match schedules for 4+ players across any number of courts with intelligent rotation
          </p>
        </div>

        {/* Data Entry Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 mb-12 p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 flex items-center">
            <span className="mr-3">📝</span>
            Setup Your Session
          </h2>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Dials Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
              {/* Courts Dial */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col items-center">
                <span className="text-3xl mb-2">🏟️</span>
                <label className="block text-lg font-semibold text-blue-800 mb-2">Courts</label>
                <input
                  type="range"
                  min={1}
                  max={maxCourts}
                  step={1}
                  value={courts}
                  onChange={e => setCourts(Math.max(1, Math.min(maxCourts, Number(e.target.value))))}
                  className="w-full accent-blue-600"
                />
                <span className="mt-2 text-blue-700 font-bold text-xl">{courts}</span>
                <span className="text-gray-500 text-xs mt-1">Max: {maxCourts}</span>
              </div>
              {/* Duration Dial */}
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 flex flex-col items-center">
                <span className="text-3xl mb-2">⏰</span>
                <label className="block text-lg font-semibold text-purple-800 mb-2">Duration (hours)</label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={duration}
                  onChange={e => setDuration(Math.max(1, Math.min(8, Number(e.target.value))))}
                  className="w-full accent-purple-600"
                />
                <span className="mt-2 text-purple-700 font-bold text-xl">{duration}h</span>
              </div>
              {/* Round Duration Dial */}
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 flex flex-col items-center">
                <span className="text-3xl mb-2">🔁</span>
                <label className="block text-lg font-semibold text-green-800 mb-2">Round Duration (min)</label>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={roundDuration}
                  onChange={e => setRoundDuration(Math.max(5, Math.min(60, Number(e.target.value))))}
                  className="w-full accent-green-600"
                />
                <span className="mt-2 text-green-700 font-bold text-xl">{roundDuration}m</span>
              </div>
            </div>
            {/* Calculated Rounds Info */}
            {numRounds > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 mt-2 mb-2">
                <span className="text-lg text-blue-700 font-semibold bg-blue-50 rounded-lg px-4 py-2 shadow-sm">Calculated Rounds: <span className="font-bold">{numRounds}</span></span>
                <span className="text-lg text-purple-700 font-semibold bg-purple-50 rounded-lg px-4 py-2 shadow-sm">Round Duration: <span className="font-bold">{roundDuration} min</span></span>
              </div>
            )}
            {/* Player Names Section */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <label htmlFor="players" className="block text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <span className="mr-2">👤</span>
                Enter player names (separated by commas or new lines):
              </label>
              <textarea
                id="players"
                value={playerInput}
                onChange={(e) => setPlayerInput(e.target.value)}
                placeholder="Alice, Bob, Charlie, David, Emma, Fred, George, Hannah, Isaac, Jack, Karen, Liam"
                className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 resize-none h-32 text-lg bg-white"
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-red-400">⚠️</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-center mt-8">
              <button 
                type="submit" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-12 rounded-xl text-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                🚀 Generate Schedule
              </button>
            </div>
          </form>
        </div>

        {/* Leaderboard Dashboard */}
        {schedule && (
          <div className="mb-12">
            <div className="bg-white/90 rounded-2xl shadow-xl border border-white/20 p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="mr-3">🏆</span>
                Leaderboard (Most Wins)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-lg">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2 px-4">Rank</th>
                      <th className="py-2 px-4">Player</th>
                      <th className="py-2 px-4">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getLeaderboard().map(([player, wins], idx) => (
                      <tr key={player} className={idx === 0 ? 'bg-yellow-100 font-bold' : ''}>
                        <td className="py-2 px-4">{idx + 1}</td>
                        <td className="py-2 px-4">{player}</td>
                        <td className="py-2 px-4">{wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Display */}
        {schedule && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-3xl font-bold text-gray-800 flex items-center">
                <span className="mr-3">📅</span>
                Match Schedule
              </h2>
              <button 
                onClick={handleRegenerate} 
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center"
              >
                <span className="mr-2">🔄</span>
                Regenerate Schedule
              </button>
            </div>
            {/* Player Statistics */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <span className="mr-3">📊</span>
                Player Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {Object.entries(getPlayerStats()).map(([player, games]) => (
                  <div key={player} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 hover:shadow-md transition-all duration-200">
                    <div className="font-bold text-gray-800 mb-1">{player}</div>
                    <div className="text-2xl font-bold text-blue-600">{games}</div>
                    <div className="text-sm text-gray-500">games</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Schedule Rounds */}
            <div className="grid gap-8">
              {schedule.rounds.map((round, roundIndex) => (
                <div key={roundIndex} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
                  <h3 className="text-2xl font-bold mb-6 flex items-center">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm mr-4">
                      Round {roundIndex + 1}
                    </span>
                    <span className="text-gray-600">• {roundDuration} minutes</span>
                  </h3>
                  <div className={`grid gap-8 lg:grid-cols-${courts + 1}`}>
                    {round.courts.map((court, courtIdx) => (
                      <div className="space-y-4" key={courtIdx}>
                        <h4 className={`text-xl font-bold ${courtIdx % 2 === 0 ? 'text-green-700' : 'text-purple-700'} flex items-center`}>
                          <span className="mr-2">🏟️</span>
                          Court {courtIdx + 1}
                        </h4>
                        <div className={`p-6 rounded-xl border-2 ${courtIdx % 2 === 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'}`}>
                          {court.map((player, index) => (
                            <div key={index} className="flex items-center mb-3 last:mb-0">
                              <div className={`w-8 h-8 ${courtIdx % 2 === 0 ? 'bg-green-500' : 'bg-purple-500'} text-white rounded-full flex items-center justify-center font-bold text-sm mr-3`}>
                                {index + 1}
                              </div>
                              <span className="font-semibold text-gray-800">{player}</span>
                            </div>
                          ))}
                        </div>
                        {/* Winner selection for this court */}
                        <div className="mt-4 flex flex-col gap-2">
                          <span className="font-semibold text-md">Select Winner:</span>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              className={`px-3 py-1 rounded-lg font-bold border-2 transition-all duration-150 ${winners[roundIndex]?.[courtIdx]===1 ? 'bg-green-500 text-white border-green-600' : 'bg-white border-green-300 text-green-700 hover:bg-green-50'}`}
                              onClick={() => setCourtWinner(roundIndex, courtIdx, 1)}
                            >
                              Team 1 ({court[0]}, {court[1]})
                            </button>
                            <button
                              className={`px-3 py-1 rounded-lg font-bold border-2 transition-all duration-150 ${winners[roundIndex]?.[courtIdx]===2 ? 'bg-purple-500 text-white border-purple-600' : 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50'}`}
                              onClick={() => setCourtWinner(roundIndex, courtIdx, 2)}
                            >
                              Team 2 ({court[2]}, {court[3]})
                            </button>
                            {winners[roundIndex]?.[courtIdx] && (
                              <span className="ml-2 text-green-700 font-semibold">Winner: {winners[roundIndex][courtIdx] === 1 ? `Team 1 (${court[0]}, ${court[1]})` : `Team 2 (${court[2]}, ${court[3]})`}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="space-y-4">
                      <h4 className="text-xl font-bold text-gray-600 flex items-center">
                        <span className="mr-2">😴</span>
                        Resting
                      </h4>
                      <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-6 rounded-xl border-2 border-gray-200">
                        {round.resting.length === 0 ? (
                          <div className="text-gray-400 italic">No one resting</div>
                        ) : (
                          round.resting.map((player, index) => (
                            <div key={index} className="flex items-center mb-3 last:mb-0">
                              <div className="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold text-sm mr-3">
                                {index + 1}
                              </div>
                              <span className="font-semibold text-gray-600">{player}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
