import brandLogo from 'figma:asset/aa914b18f567f6825fda46e6657ced11e5c34887.png';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white dark:bg-[#000000] flex items-center justify-center z-50">
      <div className="animate-pulse">
        <img 
          src={brandLogo} 
          alt="Screndly" 
          className="w-[100.99px] h-[100.99px] sm:w-[117.15px] sm:h-[117.15px] md:w-[134.32px] md:h-[134.32px]"
        />
      </div>
    </div>
  );
}