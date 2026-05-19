import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

const DateRangePicker = ({
  datePreset,
  setDatePreset,
  customDateFrom,
  setCustomDateFrom,
  customDateTo,
  setCustomDateTo
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Calendar view state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoverDate, setHoverDate] = useState(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (day) => {
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const formattedDate = selectedDate.toISOString().split('T')[0];

    setDatePreset('custom');

    if (!customDateFrom || (customDateFrom && customDateTo)) {
      // First click: set start date, clear end date
      setCustomDateFrom(formattedDate);
      setCustomDateTo('');
    } else {
      // Second click: set end date
      if (formattedDate < customDateFrom) {
        // Swap if clicked date is before start date
        setCustomDateTo(customDateFrom);
        setCustomDateFrom(formattedDate);
      } else {
        setCustomDateTo(formattedDate);
      }
      setIsOpen(false); // Close calendar on range completion
    }
  };

  const handlePresetSelect = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setCustomDateFrom('');
      setCustomDateTo('');
      setIsOpen(false);
    }
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(parts[1]) - 1]} ${parts[2]}, ${parts[0]}`;
  };

  const getTriggerLabel = () => {
    if (datePreset === 'all') return 'All Time';
    if (datePreset === '7d') return 'Last 7 Days';
    if (datePreset === '30d') return 'Last 30 Days';
    if (datePreset === '90d') return 'Last 90 Days';
    if (datePreset === '1y') return 'Last 1 Year';
    if (datePreset === 'custom') {
      if (customDateFrom && customDateTo) {
        return `${formatDateString(customDateFrom)} - ${formatDateString(customDateTo)}`;
      } else if (customDateFrom) {
        return `From ${formatDateString(customDateFrom)}...`;
      }
      return 'Select Dates';
    }
    return 'All Time';
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const weeks = [];
    let days = [];

    // Empty spots for first week
    for (let i = 0; i < firstDay; i++) {
      days.push(<td key={`empty-${i}`} className="p-1 text-center text-slate-300"></td>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const thisDate = new Date(year, month, day);
      const dateStr = thisDate.toISOString().split('T')[0];

      const isSelectedStart = customDateFrom === dateStr;
      const isSelectedEnd = customDateTo === dateStr;
      const isRange = customDateFrom && customDateTo && dateStr >= customDateFrom && dateStr <= customDateTo;
      
      let inHoverRange = false;
      if (customDateFrom && !customDateTo && hoverDate && dateStr >= customDateFrom && dateStr <= hoverDate) {
        inHoverRange = true;
      }

      let dayClass = "w-8 h-8 rounded-lg flex items-center justify-center text-[0.78rem] font-extrabold cursor-pointer transition-all ";
      
      if (isSelectedStart || isSelectedEnd) {
        dayClass += "bg-slate-900 text-white shadow-md hover:bg-slate-800 scale-105";
      } else if (isRange) {
        dayClass += "bg-indigo-50 text-indigo-700 hover:bg-indigo-100";
      } else if (inHoverRange) {
        dayClass += "bg-slate-100 text-slate-700 border border-dashed border-slate-300";
      } else {
        dayClass += "text-slate-600 hover:bg-slate-100 hover:text-slate-950";
      }

      days.push(
        <td 
          key={day} 
          className="p-1 text-center align-middle"
          onMouseEnter={() => !customDateTo && setHoverDate(dateStr)}
        >
          <button
            onClick={() => handleDateClick(day)}
            className={dayClass}
          >
            {day}
          </button>
        </td>
      );

      if (days.length === 7 || day === daysInMonth) {
        while (days.length < 7) {
          days.push(<td key={`empty-end-${days.length}`} className="p-1"></td>);
        }
        weeks.push(<tr key={`week-${day}`}>{days}</tr>);
        days = [];
      }
    }

    return (
      <div className="flex flex-col p-4 w-[280px]">
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={handlePrevMonth} 
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[0.8rem] font-black text-slate-800 uppercase tracking-wider">
            {monthNames[month]} {year}
          </span>
          <button 
            onClick={handleNextMonth} 
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <th key={d} className="pb-2 text-center text-[0.68rem] font-black text-slate-400 uppercase tracking-widest w-8">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks}
          </tbody>
        </table>
        {customDateFrom && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[0.7rem]">
            <div className="text-slate-500 font-bold">
              {customDateTo ? 'Range Selected' : 'Choose End Date...'}
            </div>
            <button
              onClick={() => {
                setCustomDateFrom('');
                setCustomDateTo('');
                setDatePreset('all');
              }}
              className="text-rose-500 hover:text-rose-700 font-black flex items-center gap-1 transition-colors uppercase tracking-wider"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-10 flex items-center gap-2 px-3 rounded-lg text-[0.78rem] font-extrabold border bg-white shadow-sm transition-all hover:border-slate-300 ${
          isOpen ? 'border-slate-900 ring-2 ring-slate-100 text-slate-950' : 'border-slate-200 text-slate-700'
        }`}
      >
        <CalendarIcon size={14} className={datePreset === 'custom' ? 'text-indigo-600' : 'text-slate-400'} />
        <span>{getTriggerLabel()}</span>
        <ChevronRight size={14} className={`text-slate-400 transition-transform ml-1 ${isOpen ? 'rotate-90 text-slate-700' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-[9999] flex flex-row">
          {/* Preset list on the left */}
          <div className="flex flex-col bg-slate-50/50 border-r border-slate-100 p-2 w-[140px] justify-between">
            <div className="flex flex-col gap-1">
              <div className="px-2 py-1 text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1">Presets</div>
              {[
                { id: 'all', label: 'All Time' },
                { id: '7d', label: 'Last 7 Days' },
                { id: '30d', label: 'Last 30 Days' },
                { id: '90d', label: 'Last 90 Days' },
                { id: '1y', label: 'Last 1 Year' },
                { id: 'custom', label: 'Custom Range' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[0.75rem] font-extrabold transition-all ${
                    datePreset === p.id 
                      ? 'bg-slate-900 text-white' 
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar grid on the right (only for custom or as visual aid) */}
          {renderCalendar()}
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
