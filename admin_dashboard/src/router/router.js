import { createRouter, createWebHistory } from 'vue-router'

import AdminPanel from '../views/admin/AdminPanel.vue'
import AdminLogin from '../views/admin/adminLogin.vue'
import CourseAdmin from '../views/admin/CourseAdmin.vue'
import UsersAdmin from '../views/admin/UsersAdmin.vue'
import SupportAdmin from '../views/admin/SupportAdmin.vue'

import {
  getCurrentUser,
  isAdmin,
} from '../api/authApi.js'

const sections = [
  {
    path: '/admin',
    name: 'admin-panel',
    section: 'Dashboard',
  },
  {
    path: '/admin/news',
    name: 'admin-news',
    section: 'News',
  },
  {
    path: '/admin/journal',
    name: 'admin-journal',
    section: 'Trading Journal',
  },
  {
    path: '/admin/academy',
    name: 'admin-academy',
    section: 'Academy',
  },
  {
    path: '/admin/analysis',
    name: 'admin-analysis',
    section: 'Analysis',
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    section: 'Users',
  },
  {
    path: '/admin/support',
    name: 'admin-support',
    section: 'Support',
  },
  {
    path: '/admin/settings',
    name: 'admin-settings',
    section: 'Settings',
  },
]

function sectionComponent(section) {
  if (section === 'Academy') return CourseAdmin
  if (section === 'Users') return UsersAdmin
  if (section === 'Support') return SupportAdmin

  // Includes Dashboard, News, Trading Journal,
  // Analysis, and Settings.
  return AdminPanel
}

const router = createRouter({
  history: createWebHistory(),

  routes: [
    {
      path: '/',
      redirect: '/admin',
    },
    {
      path: '/login',
      name: 'admin-login',
      component: AdminLogin,
    },

    ...sections.map(({ path, name, section }) => ({
      path,
      name,
      component: sectionComponent(section),

      meta: {
        requiresAuth: true,
        requiresAdmin: true,
        section,
      },
    })),

    {
      path: '/:pathMatch(.*)*',
      redirect: '/admin',
    },
  ],
})

router.beforeEach(async to => {
  if (!to.meta.requiresAdmin) return true

  try {
    const user = await getCurrentUser()

    if (isAdmin(user)) return true
  } catch {
    // An expired session also redirects to login.
  }

  return {
    name: 'admin-login',
    query: {
      redirect: to.fullPath,
    },
  }
})

export default router