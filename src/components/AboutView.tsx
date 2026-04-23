import React from 'react';
import { Logo } from './Logo';
import { motion } from 'motion/react';
import { Info, Mail, Github, Globe } from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-50 overflow-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8 md:p-12 text-center"
      >
        <Logo centered className="mb-8" />
        
        <div className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold mb-6">
          Version 2.0
        </div>

        <div className="space-y-6 text-slate-600 leading-relaxed">
          <p className="text-lg">
            <strong>ScheduleQu</strong> is a comprehensive Workforce Management (WFM) solution designed to streamline scheduling, tracking, and forecasting for modern workforces.
          </p>
          
          <p className="text-sm">
            Leveraging real-time data and AI-powered forecasting, ScheduleQu helping teams reach optimal service levels while maintaining operational efficiency and employee engagement.
          </p>

          <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Developed By</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-800 tracking-tighter uppercase italic">rys</span>
                <span className="text-slate-300">|</span>
                <span className="text-sm font-semibold text-slate-500 italic">Est. 2024</span>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Connect with us</span>
              <div className="flex justify-center gap-4">
                <a href="mailto:support@schedulequ.com" className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm">
                  <Mail size={20} />
                </a>
                <a href="#" className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm">
                  <Github size={20} />
                </a>
                <a href="#" className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-all shadow-sm">
                  <Globe size={20} />
                </a>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-300 mt-4">
               &copy; {new Date().getFullYear()} ScheduleQu. All rights reserved.
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
