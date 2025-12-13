import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";

export default function PublicLayout() {
  return (
    <div className="flex w-screen min-h-screen bg-gradient-to-br from-[#0b1220] to-[#0e0f19] text-white">
      <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />

        <motion.div
          className="absolute -bottom-40 -left-32 h-96 w-96 bg-[#0d4b7b] opacity-20 rounded-full blur-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ duration: 2, delay: 0.5 }}
        />
      </main>
    </div>
  );
}
