"use client";

import { useState } from "react";
import { 
  ChevronLeft, ChevronRight, Plus, X, 
  Calendar as CalendarIcon, Clock, Edit, Trash, 
  FileText, Sparkles, Target, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CalendarClient({ initialEvents }: { initialEvents: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper to generate days of the month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Adjust so Monday is 0 and Sunday is 6
    return day === 0 ? 6 : day - 1;
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];
  const dayNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  // Map events to date strings
  const getEventsForDate = (date: Date) => {
    return initialEvents.filter(e => {
      const eDate = new Date(e.createdAt);
      return eDate.getDate() === date.getDate() && 
             eDate.getMonth() === date.getMonth() && 
             eDate.getFullYear() === date.getFullYear();
    });
  };

  const days = [];
  // Empty slots before first day
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="min-h-[120px] p-2 border-b border-r border-border/50 bg-muted/10"></div>);
  }

  // Actual days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const isToday = date.toDateString() === new Date().toDateString();
    const dayEvents = getEventsForDate(date);
    
    days.push(
      <div key={`day-${i}`} className={`min-h-[120px] p-2 border-b border-r border-border/50 hover:bg-muted/20 transition-colors ${isToday ? 'bg-primary/5' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            {i}
          </span>
          {dayEvents.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {dayEvents.length} İçerik
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto max-h-[80px] scrollbar-thin">
          {dayEvents.map(e => {
            const isPublished = e.status === 'PUBLISHED';
            const isReady = e.status === 'READY_TO_PUBLISH';
            return (
              <div 
                key={e.id}
                className={`text-[11px] px-2 py-1 rounded-md truncate cursor-pointer transition-opacity hover:opacity-80 flex items-center gap-1.5 ${
                  isPublished ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium" :
                  isReady ? "bg-sky-500/10 border border-sky-500/20 text-[#164E7A] dark:text-sky-400 font-medium" :
                  "bg-muted border border-border/70 text-muted-foreground"
                }`}
                title={e.title}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPublished ? 'bg-emerald-500' : isReady ? 'bg-sky-500' : 'bg-muted-foreground'}`} />
                <span className="truncate">{e.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-card border-border/80 shadow-xs overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-border/70 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-border/80 bg-background overflow-hidden shadow-xs">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-none hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-bold text-sm px-4 min-w-[130px] text-center text-foreground">
              {monthNames[month]} {year}
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-none hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 text-xs font-semibold border-border/80">
            Bugün
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-7 border-b border-border/70 bg-muted/30">
          {dayNames.map((d, i) => (
            <div key={i} className="p-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-border/50">
          {days}
        </div>
      </CardContent>
    </Card>
  );
}
