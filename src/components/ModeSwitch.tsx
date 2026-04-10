'use client';
import { useRouter } from "next/navigation";

interface ModeSwitchProps {
  isPublic: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function ModeSwitch({ isPublic, className = "", style = {} }: ModeSwitchProps) {
  const router = useRouter();

  const toggleMode = () => {
    if (isPublic) {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  return (
    <div className={`nav-switch-container ${className}`} style={style}>
      <label className="nav-switch">
        <input 
          type="checkbox" 
          checked={isPublic} 
          onChange={toggleMode} 
        />
        <span className="nav-slider"></span>
      </label>
    </div>
  );
}
