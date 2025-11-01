function Button({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-block group ${className}`}
    >
      {/* Bottom shadow layer - dark blue */}
      <div className="absolute inset-0 bg-[#0B3251] blur-[4px] translate-y-[3px] translate-x-[3px]"></div>
      
      {/* Left shadow accent - dark blue */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[6px] h-[80%] bg-[#0B3251] blur-[4px]"></div>
      
      {/* Top highlight - light gray */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] h-[6px] bg-[#DDE8E2] blur-[4px]"></div>
      
      {/* Right highlight accent - light gray */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[6px] h-[80%] bg-[#DDE8E2] blur-[4px]"></div>
      
      {/* Main button */}
      <div className="relative px-12 py-5 bg-[#2B94DE] hover:bg-[#2485ca] disabled:bg-gray-400 text-white text-5xl font-normal transition-all duration-200 group-hover:translate-y-[-2px] border border-black" style={{ fontFamily: 'Alumni Sans Collegiate One, sans-serif' }}>
        {children}
      </div>
    </button>
  )
}

export default Button
