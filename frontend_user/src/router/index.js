import { createRouter, createWebHistory } from 'vue-router'
import HomeViews from '../views/HomeViews.vue'
import NewsViews from '../views/NewsViews.vue'
import AcademyViews from '../views/AcademyViews.vue'
import AnalysisViews from '../views/AnalysisViews.vue'
import SupportViews from '../views/SupportViews.vue'
import AboutViews from '../views/AboutViews.vue'
import DisclaimerViews from '../views/DisclaimerViews.vue'
import AuthViews from '../views/AuthViews.vue'
import CollaborateViews from '../views/CollaborateViews.vue'
import ForgotPasswordViews from '../views/ForgotPasswordViews.vue'
import DashboardHome from '../views/dashboard/DashboardHome.vue'
import ProfileViews from '../views/dashboard/ProfileViews.vue'



const pages = [
  {
    path: '',
    name: 'home',
    component: HomeViews,
  },
  {
    path: '/news',
    name: 'news',
    component: NewsViews,
  },
  {
    path: '/academy',
    name: 'academy',
    component: AcademyViews,
  },
  {
    path: '/analysis',
    name: 'analysis',
    component: AnalysisViews,
  },
  {
    path: '/analysis/:category(ict|pdarray|csnr|sms)',
    name: 'analysis-category',
    component: AnalysisViews,
  },
  {
    path: '/collaborate/:broker?',
    name: 'collaborate',
    component: CollaborateViews,
  },
  {
    path: '/getsupport',
    name: 'support',
    component: SupportViews,
  },
  {
    path: '/about',
    name: 'about',
    component: AboutViews,
  },
  {
    path: '/disclaimer',
    name: 'disclaimer',
    component: DisclaimerViews,
  },
  {
    path: '/login',
    name: 'login',
    component: AuthViews,
    props: { mode: 'login' },
  },
  {
    path: '/register',
    name: 'register',
    component: AuthViews,
    props: { mode: 'register' },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordViews,
    props: { mode: 'forgot-password' },
  },
  
]

const routes = [
  ...pages.map((page) => ({
    ...page,
    path: `/:lang(km)?${page.path}`,
  })),
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router