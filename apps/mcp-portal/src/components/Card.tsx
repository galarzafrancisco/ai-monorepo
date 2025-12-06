export const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full max-w-sm backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-xl">
    {children}
  </div>
);
