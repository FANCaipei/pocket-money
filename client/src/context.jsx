import { createContext, useContext } from 'react';

/** 应用全局上下文：数据 + 动作 + 弹层控制 */
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
