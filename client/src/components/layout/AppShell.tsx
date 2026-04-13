import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  LineChart,
  Settings,
  Briefcase,
  History,
  Database,
  Search,
  FlaskConical,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'

export interface AppShellProps {
  /** Shown next to the menu trigger in the top bar */
  title?: string
  children?: ReactNode
}

export function AppShell({ title = 'Algo Trading', children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const path = location.pathname

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-sm">
              AT
            </div>
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              {title}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Dashboard"
                    isActive={path === '/dashboard'}
                    onClick={() => navigate('/dashboard')}
                  >
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Holdings"
                    isActive={path === '/holdings'}
                    onClick={() => navigate('/holdings')}
                  >
                    <Briefcase />
                    <span>Holdings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Orders"
                    isActive={path === '/orders'}
                    onClick={() => navigate('/orders')}
                  >
                    <History />
                    <span>Orders</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Market Data"
                    isActive={path === '/market-data'}
                    onClick={() => navigate('/market-data')}
                  >
                    <Database />
                    <span>Market Data</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Instruments"
                    isActive={path === '/instruments'}
                    onClick={() => navigate('/instruments')}
                  >
                    <Search />
                    <span>Instruments</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Strategies"
                    isActive={path === '/backtest'}
                    onClick={() => navigate('/backtest')}
                  >
                    <LineChart />
                    <span>Strategies</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Backtest"
                    isActive={path === '/backtest'}
                    onClick={() => navigate('/backtest')}
                  >
                    <FlaskConical />
                    <span>Backtest</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                isActive={path === '/settings'}
                onClick={() => navigate('/settings')}
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="flex max-h-svh flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="font-semibold">{title}</span>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
