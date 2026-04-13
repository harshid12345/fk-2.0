import { Building2, AlertCircle, Settings, LogOut, Globe } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

export function AppSidebar() {
  const { signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const navItems = [
    { path: '/properties', label: t('nav.properties'), icon: Building2 },
    { path: '/issues', label: t('nav.issues'), icon: AlertCircle },
    { path: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <div className="p-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-foreground text-sm group-data-[collapsible=icon]:hidden">FairKamer</span>
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.path}
                      className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      activeClassName="text-foreground bg-accent border-l-[3px] border-l-primary"
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="text-sm group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-1 group-data-[collapsible=icon]:p-2">
        <button
          onClick={() => setLang(lang === 'en' ? 'nl' : 'en')}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors w-full text-left"
        >
          <Globe className="w-[18px] h-[18px] shrink-0" />
          <span className="text-sm group-data-[collapsible=icon]:hidden">
            {lang === 'en' ? 'EN' : 'NL'} | {lang === 'en' ? 'NL' : 'EN'}
          </span>
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors w-full text-left"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span className="text-sm group-data-[collapsible=icon]:hidden">{t('settings.sign_out')}</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
