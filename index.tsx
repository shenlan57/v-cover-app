
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- TYPES ---
enum DesignStyle {
  BRUTALIST = 'Modern Brutalist',
  VOGUE = 'Editorial Vogue',
  MINIMALIST = 'Minimalist Luxury',
  CYBERPUNK = 'Cyberpunk Neon',
  CINEMATIC = 'Cinematic Noir',
  ABSTRACT = 'Avant-Garde'
}

interface DesignPreset {
  id: DesignStyle;
  name: string;
  description: string;
  thumbnail: string;
  promptModifier: string;
}

// --- CONSTANTS ---
const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: DesignStyle.BRUTALIST,
    name: '现代力量',
    description: '充满力量感的粗体排版与工业冷色调。',
    thumbnail: 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?q=80&w=400&h=600&auto=format&fit=crop',
    promptModifier: 'brutalist graphic design, oversized grotesque bold fonts, Swiss typography, high contrast, minimalist brutalism'
  },
  {
    id: DesignStyle.VOGUE,
    name: '时尚画报',
    description: '经典衬线体，杂志风图文穿插排版。',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&h=600&auto=format&fit=crop',
    promptModifier: 'luxury fashion magazine cover, Didot or Bodoni fonts, elegant serif typography, Vogue editorial layout, sophisticated kerning'
  },
  {
    id: DesignStyle.MINIMALIST,
    name: '极简静奢',
    description: '纤细字体，大量的艺术留白。',
    thumbnail: 'https://images.unsplash.com/photo-1544450181-29597f6ee557?q=80&w=400&h=600&auto=format&fit=crop',
    promptModifier: 'minimalist luxury, thin sans-serif typography, clean airy layout, beige and white tones, premium studio lighting'
  },
  {
    id: DesignStyle.CYBERPUNK,
    name: '霓虹幻想',
    description: '发光特效，具有冲击力的故障风字体。',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=400&h=600&auto=format&fit=crop',
    promptModifier: 'cyberpunk neon aesthetic, glowing typography, tech-noir layout, digital glitch effects, futuristic UI elements'
  },
  {
    id: DesignStyle.CINEMATIC,
    name: '经典影像',
    description: '电影片头感，宽银幕比例文字。',
    thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=400&h=600&auto=format&fit=crop',
    promptModifier: 'cinematic film poster credits, anamorphic cinematic framing, moody chiaroscuro lighting, classic movie titling'
  },
  {
    id: DesignStyle.ABSTRACT,
    name: '先锋艺术',
    description: '实验性的字体扭曲，适合创意内容。',
    thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&h=600&auto=format&fit=crop',
    promptModifier: 'avant-garde abstract design, distorted typography as art, surreal gradients, experimental poster layout'
  }
];

// --- UTILS ---
const extractFrame = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => { video.currentTime = video.duration / 4; };
    video.onseeked = () => {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } else reject(new Error("Canvas failed"));
    };
    video.onerror = (e) => reject(e);
    video.src = url;
    video.load();
  });
};

// --- SERVICE ---
const generateArtisticCover = async (frameBase64: string, style: string, extra: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const imageData = frameBase64.split(',')[1];

  // 1. 排版规划：通过 Flash 模型获取排版灵感
  const plan = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageData } },
        { text: `作为一位在纽约工作的设计大师，请分析此视频截图。
          1. 评估构图：人物是居中还是三分法？
          2. 选择一个充满暗示的时尚标题（如 "MANIFESTO", "ECHOES", "URBAN"）。
          3. 确定最佳字体层级：大标题位置、副标题位置、以及是否与人物层级重叠。
          输出一段专业的图像生成 Prompt，重点描述排版的字体风格、字距和布局，结合风格：${style}。` }
      ]
    }]
  });

  // 2. 图像生成：强制执行排版要求
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageData } },
        { text: `MASTER RECONSTRUCTION: 9:16 HIGH-END VIDEO COVER.
          STRICT DESIGN RULES:
          1. PERSON: Must be the identical person from the image, enhanced with professional studio lighting.
          2. TYPOGRAPHY: Overlay a masterfully designed artistic title. The text must feature premium kerning and visual hierarchy. Use fonts: ${style}. 
          3. LAYOUT: Place the typography strategically according to: ${plan.text}. 
          4. ARTISTIC DETAIL: ${extra}.
          5. RESULT: A clean, commercial-ready magazine cover that looks like it was designed by a human creative director.` }
      ]
    },
    config: { imageConfig: { aspectRatio: "9:16" } }
  });

  let imageUrl = '';
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) { imageUrl = `data:image/png;base64,${part.inlineData.data}`; break; }
    }
  }
  if (!imageUrl) throw new Error("AI Generation Error");
  return imageUrl;
};

// --- APP COMPONENT ---
const App: React.FC = () => {
  const [previewFrame, setPreviewFrame] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<DesignPreset>(DESIGN_PRESETS[0]);
  const [instruction, setInstruction] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const frame = await extractFrame(file);
        setPreviewFrame(frame);
        setCurrentResult(null);
        setError(null);
      } catch (err) { setError("素材格式不支持"); }
    }
  };

  const onGenerate = async () => {
    if (!previewFrame) return;
    setIsGenerating(true); setError(null);
    try {
      const res = await generateArtisticCover(previewFrame, selectedStyle.promptModifier, instruction);
      setCurrentResult(res);
    } catch (err) { setError("AI 引擎忙，请重新尝试"); }
    finally { setIsGenerating(false); }
  };

  return (
    <div className="app-container scrollbar-hide">
      <header className="px-6 pt-10 pb-4 flex justify-between items-center bg-transparent z-50">
        <div>
          <h1 className="font-display italic text-2xl gold-gradient-text leading-none">V-Cover</h1>
          <p className="text-[7px] tracking-[0.5em] text-zinc-600 uppercase mt-1">Editorial AI Studio</p>
        </div>
        <button onClick={() => { setPreviewFrame(null); setCurrentResult(null); }} className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/10 active:scale-90 transition-all">
          <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2"/></svg>
        </button>
      </header>

      <main className="px-6 space-y-6 pb-44 overflow-y-auto scrollbar-hide">
        <section className="relative w-full aspect-[9/16] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 glass-panel mx-auto animate-floating">
          {isGenerating && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-3xl">
              <div className="w-16 h-[1px] bg-amber-500 animate-pulse mb-8"></div>
              <p className="text-[10px] tracking-[0.6em] text-amber-100 uppercase animate-pulse">正在重构封面美学</p>
              <p className="text-[8px] text-zinc-500 mt-4 tracking-[0.2em]">CRAFTING ARTISTIC TYPOGRAPHY...</p>
            </div>
          )}
          {currentResult ? (
            <img src={currentResult} className="w-full h-full object-cover animate-in fade-in duration-1000" />
          ) : previewFrame ? (
            <div className="relative w-full h-full">
              <img src={previewFrame} className="w-full h-full object-cover opacity-60 grayscale" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 rounded-full border border-dashed border-zinc-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-zinc-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="1"/></svg>
              </div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-zinc-700">导入竖屏原视频</p>
            </div>
          )}
        </section>

        <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">封面风格画廊</h3>
              <span className="text-[10px] text-amber-500 font-medium">{selectedStyle.name}</span>
            </div>
            <div className="flex gap-4 overflow-x-auto style-scrollbar pb-6 pt-1">
              {DESIGN_PRESETS.map(preset => (
                <div 
                  key={preset.id} onClick={() => setSelectedStyle(preset)}
                  className={`flex-shrink-0 w-32 aspect-[3/4] rounded-2xl overflow-hidden border transition-all duration-500 cursor-pointer ${selectedStyle.id === preset.id ? 'border-amber-500 scale-95 shadow-xl shadow-amber-500/20' : 'border-white/5 opacity-30 grayscale hover:opacity-100'}`}
                >
                  <div className="relative w-full h-full">
                    <img src={preset.thumbnail} className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black p-3 pt-6 text-[9px] text-white/90 uppercase text-center font-bold tracking-tighter">
                      {preset.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 px-1">
             <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">自定义主标题</h3>
             <input
                value={instruction} onChange={(e) => setInstruction(e.target.value)}
                placeholder="例如：主标题 'SUMMER'、加入电影颗粒感..."
                className="w-full bg-transparent border-b border-zinc-900 text-[11px] py-4 focus:border-amber-500 outline-none transition-colors placeholder:text-zinc-800 text-zinc-300"
              />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-auto z-50">
        <div className="max-w-[420px] mx-auto flex gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center transition-all active:scale-90">
             <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="1.5"/></svg>
          </button>
          <input ref={fileInputRef} type="file" className="hidden" accept="video/*" onChange={onFile} />
          
          <button
             onClick={onGenerate} disabled={!previewFrame || isGenerating}
             className={`flex-1 rounded-2xl text-[11px] font-bold uppercase tracking-[0.6em] transition-all duration-700 active:scale-95 ${!previewFrame || isGenerating ? 'bg-zinc-800 text-zinc-700' : 'bg-white text-black shadow-2xl'}`}
          >
            {isGenerating ? '设计中...' : '生成艺术封面'}
          </button>

          {currentResult && (
            <button onClick={() => { const a = document.createElement('a'); a.href = currentResult; a.download = 'vcover.png'; a.click(); }} className="w-14 h-14 rounded-2xl bg-amber-500 border border-amber-400 flex items-center justify-center shadow-lg active:scale-90">
             <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2"/></svg>
            </button>
          )}
        </div>
        {error && <p className="text-[9px] text-red-500/80 text-center mt-4 tracking-widest">{error}</p>}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
