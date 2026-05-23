import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
  },
  {
    path: '/agents/:id',
    name: 'AgentDetail',
    component: () => import('../views/AgentDetail.vue'),
    props: true,
  },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
