'use client'

import { Users, GraduationCap, ArrowRight, DoorOpen } from 'lucide-react'
import { Card, Pill } from '@/components/ui-kit'
import type { AdminClassCatalogItem } from '@/lib/api'

type ClassCardProps = {
  classItem: AdminClassCatalogItem
  onClick: () => void
}

export function ClassCard({ classItem, onClick }: ClassCardProps) {
  const isLowCount = classItem.student_count < 10

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="group relative flex flex-col justify-between rounded-2xl border border-line bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div>
        {/* Top badge row */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Pill className="bg-primary/10 text-primary border border-primary/20 font-semibold text-xs">
            Grade {classItem.grade_level}
          </Pill>
          <span className="text-xs text-muted font-medium">
            {classItem.academic_year}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-ink tracking-tight group-hover:text-primary transition-colors">
          {classItem.name}
        </h3>

        {/* Room / Location */}
        {classItem.room && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <DoorOpen className="size-3.5 text-muted/70" />
            <span>{classItem.room}</span>
          </p>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Users className="size-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-ink leading-tight">
              {classItem.student_count}{' '}
              <span className="text-xs font-normal text-muted">students</span>
            </span>
          </div>
        </div>

        <div className="flex items-center text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform">
          <span>Open</span>
          <ArrowRight className="size-3.5 ml-1" />
        </div>
      </div>
    </div>
  )
}
