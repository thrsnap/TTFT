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
import ProfileViews from '../views/user/ProfileViews.vue'
import PaymentViews from '../views/user/PaymentViews.vue'
import SignalViews from '../views/SignalViews.vue'

import DashboardLayout from '../layouts/DashbordLayout.vue'
import DashboardHome from '../views/user/DashboardHome.vue'
import MyCourses from '../views/user/Mycourse.vue'
import MyNewsSignals from '../views/user/MyNewsSignal.vue'
import MyChallenges from '../views/user/MyChallenges.vue'
import MySupport from '../views/user/MySupport.vue'

import CoursePayment from '../views/CoursePayment.vue'
import CourseLessons from '../views/CourseLessons.vue'

import { useAuthStore } from '../store/user/authStore.js'

const pages = [
  {
    path: '',
    name: 'home',
    component: HomeViews,
  },
  {
    path: '/news/:category(crypto|economy|markets|insider|forex)?',
    name: 'news',
    component: NewsViews,
  },
  {
    path: '/academy',
    name: 'academy',
    component: AcademyViews,
  },
  {
    path: '/signal',
    name: 'signal',
    component: SignalViews,
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
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ForgotPasswordViews,
    props: { mode: 'reset-password' },
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('../views/VeryfyEmailViews.vue'),
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileViews,
    meta: { requiresAuth: true },
  },
  {
    path: '/payment',
    name: 'payment',
    component: PaymentViews,
    meta: { requiresAuth: true },
  },
  {
    path: '/payment/course/:courseId',
    name: 'course-payment',
    component: CoursePayment,
    meta: { requiresAuth: true },
  },
  {
    path: '/academy/course/:courseId/lessons',
    name: 'course-lessons',
    component: CourseLessons,
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    component: DashboardLayout,
    meta: {
      requiresAuth: true,
      hidePublicLayout: true,
    },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: DashboardHome,
      },
      {
        path: 'courses',
        name: 'my-courses',
        component: MyCourses,
      },
      {
        path: 'news-signals',
        name: 'my-news-signals',
        component: MyNewsSignals,
      },
      {
        path: 'challenges',
        name: 'my-challenges',
        component: MyChallenges,
      },
      {
        path: 'support',
        name: 'my-support',
        component: MySupport,
      },
    ],
  },
]

// Add the optional Khmer prefix once.
// Dashboard children inherit it from their parent.
const routes = pages.map(page => ({
  ...page,
  path: `/:lang(km)?${page.path}`,
}))

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,

  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async to => {
  const auth = useAuthStore()

  try {
    await auth.restoreSession(Boolean(to.meta.requiresAuth))
  } catch (error) {
    console.error('Session check failed:', error)

    // Stay on the current page if a protected session check fails.
    if (to.meta.requiresAuth) {
      return false
    }

    return
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'login',
      params: to.params.lang === 'km' ? { lang: 'km' } : {},
      query: {
        redirect: to.fullPath,
      },
    }
  }
})

export default router