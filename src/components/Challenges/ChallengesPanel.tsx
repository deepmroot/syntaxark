import React from 'react';
import { CHALLENGES } from '../../data/challenges';
import type { Challenge } from '../../data/challenges';
import { useFileSystem } from '../../store/useFileSystem';
import { Trophy, ChevronRight, Target } from 'lucide-react';

export const ChallengesPanel: React.FC = () => {
  const { createNode, setActiveFile, nodes } = useFileSystem();

  const handleSelectChallenge = (challenge: Challenge) => {
    // Check if a file for this challenge already exists in the VFS
    const existingFile = Object.values(nodes).find(n => n.challengeId === challenge.id);
    
    if (existingFile) {
      setActiveFile(existingFile.id);
    } else {
      // Create a new file with the challenge's initial code
      const id = createNode(
        `${challenge.title.replace(/\s+/g, '')}.js`, 
        'file', 
        null, 
        challenge.initialCode, 
        challenge.id
      );
      setActiveFile(id);
    }
  };

  return (
    <div className="h-full bg-[#252526] flex flex-col select-none overflow-hidden">
      <div className="p-3 uppercase text-[11px] font-bold text-gray-500 tracking-wider flex items-center gap-2 border-b border-[#333]">
        <Trophy size={14} className="text-yellow-500" />
        <span>Algorithm Challenges</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {CHALLENGES.map((challenge) => (
          <div 
            key={challenge.id}
            onClick={() => handleSelectChallenge(challenge)}
            className="group px-4 py-4 cursor-pointer hover:bg-[#2a2d2e] border-b border-[#333] transition-all"
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <Target size={14} className="text-blue-500 opacity-50 group-hover:opacity-100" />
                <span className="text-sm font-semibold text-gray-200 group-hover:text-blue-400 truncate max-w-[120px]">
                  {challenge.title}
                </span>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                challenge.difficulty === 'Easy' ? 'bg-green-900/30 text-green-400' :
                challenge.difficulty === 'Medium' ? 'bg-yellow-900/30 text-yellow-400' :
                'bg-red-900/30 text-red-400'
              }`}>
                {challenge.difficulty}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed group-hover:text-gray-400">
              {challenge.description}
            </p>
            <div className="mt-2 flex items-center text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Solve Problem <ChevronRight size={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
