import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
import os
from data_manager import DataManager
from text_parser import TextParser
from excel_exporter import ExcelExporter
from config import ConfigManager
from user_auth import UserManager, PERMISSIONS
from gui.dialogs import show_confirm, show_password
from utils.common import get_app_data_dir, validate_date_format


class AccountBookGUI:
    """主窗口GUI - 优化版"""

    def __init__(self, root, current_user=None):
        self.root = root
        self.root.title("账本管理工具")
        self.root.geometry("1400x900")

        self.current_user = current_user
        self.is_super_user = current_user.is_super if current_user else False

        self.data_manager = DataManager()
        self.text_parser = TextParser()
        self.excel_exporter = ExcelExporter()
        self.config = ConfigManager()
        self.user_manager = UserManager()

        # 分页状态
        self.current_page = 1
        self.page_size = 50
        self.total_pages = 1
        
        # 搜索状态
        self.search_query = ""
        self.current_sort = {"field": "date", "order": "desc"}

        self.setup_ui()
        self.refresh_list()

    def setup_ui(self):
        """设置主界面"""
        # 创建菜单栏
        self.create_menu()

        # 创建主框架
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 内容区域（左右面板）
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)

        # 左侧面板 - 输入区域
        left_panel = ttk.LabelFrame(content_frame, text="账目录入", padding=10)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 5))

        self.create_input_panel(left_panel)

        # 右侧面板 - 账目列表
        right_panel = ttk.LabelFrame(content_frame, text="账目列表", padding=10)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.create_list_panel(right_panel)

        # 底部分页控件
        self.create_pagination(main_frame)

    def create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入CSV", command=self.import_csv)
        
        can_export = self.current_user.has_permission('export_data') if self.current_user else True
        can_backup = self.current_user.has_permission('backup_data') if self.current_user else True
        
        if can_export:
            file_menu.add_command(label="导出Excel", command=self.export_excel)
            file_menu.add_command(label="导出CSV", command=self.export_csv)
        
        file_menu.add_separator()
        
        if can_backup:
            file_menu.add_command(label="备份数据", command=self.backup_data)
        
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)

        # 操作菜单
        action_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="操作", menu=action_menu)
        can_edit = self.current_user.has_permission('edit_entry') if self.current_user else True
        can_delete = self.current_user.has_permission('delete_entry') if self.current_user else True
        if can_edit:
            action_menu.add_command(label="编辑账目", command=self.edit_entry)
        if can_delete:
            action_menu.add_command(label="删除账目", command=self.delete_entry)
        action_menu.add_command(label="刷新列表", command=self.refresh_list)
        action_menu.add_separator()
        action_menu.add_command(label="筛选借出", command=lambda: self.filter_by_type("借出"))
        action_menu.add_command(label="筛选收回", command=lambda: self.filter_by_type("收回"))
        action_menu.add_command(label="显示全部", command=self.refresh_list)

        # 配置菜单
        if self.is_super_user:
            config_menu = tk.Menu(menubar, tearoff=0)
            menubar.add_cascade(label="配置", menu=config_menu)
            config_menu.add_command(label="管理预设人名", command=self.manage_preset_names)
            config_menu.add_command(label="管理关键词", command=self.manage_keywords)
            config_menu.add_command(label="管理用户", command=self.manage_users)
            config_menu.add_separator()
            config_menu.add_command(label="清空数据库", command=self.clear_database)

    def create_input_panel(self, parent):
        """创建输入面板"""
        input_frame = ttk.Frame(parent)
        input_frame.pack(fill=tk.BOTH)

        # 日期输入
        ttk.Label(input_frame, text="日期 (YYYYMMDD):").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.date_entry = ttk.Entry(input_frame, width=15)
        self.date_entry.insert(0, datetime.now().strftime("%Y%m%d"))
        self.date_entry.grid(row=0, column=1, sticky=tk.W, pady=2)

        # 人物输入
        ttk.Label(input_frame, text="人物:").grid(row=1, column=0, sticky=tk.W, pady=2)
        self.person_entry = ttk.Entry(input_frame, width=30)
        self.person_entry.grid(row=1, column=1, sticky=tk.W, pady=2)

        # 金额输入
        ttk.Label(input_frame, text="金额:").grid(row=2, column=0, sticky=tk.W, pady=2)
        self.amount_entry = ttk.Entry(input_frame, width=15)
        self.amount_entry.grid(row=2, column=1, sticky=tk.W, pady=2)

        # 类型选择
        ttk.Label(input_frame, text="类型:").grid(row=3, column=0, sticky=tk.W, pady=2)
        self.type_var = tk.StringVar(value="借出")
        type_frame = ttk.Frame(input_frame)
        type_frame.grid(row=3, column=1, sticky=tk.W, pady=2)
        ttk.Radiobutton(type_frame, text="借出", variable=self.type_var, value="借出").pack(side=tk.LEFT)
        ttk.Radiobutton(type_frame, text="收回", variable=self.type_var, value="收回").pack(side=tk.LEFT, padx=(10, 0))

        # 描述输入
        ttk.Label(input_frame, text="描述:").grid(row=4, column=0, sticky=tk.W, pady=2)
        self.description_text = scrolledtext.ScrolledText(input_frame, width=35, height=3)
        self.description_text.grid(row=4, column=1, sticky=tk.W, pady=2)

        # 按钮
        button_frame = ttk.Frame(input_frame)
        button_frame.grid(row=5, column=0, columnspan=2, pady=10)
        
        # 检查权限
        can_add = self.current_user.has_permission('add_entry') if self.current_user else True
        
        if can_add:
            ttk.Button(button_frame, text="添加账目", command=self.add_entry).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="清空", command=self.clear_input).pack(side=tk.LEFT)

        # 统计信息
        stats_frame = ttk.LabelFrame(parent, text="统计信息", padding=10)
        stats_frame.pack(fill=tk.X, pady=(10, 0))
        self.stats_label = ttk.Label(stats_frame, text="加载中...")
        self.stats_label.pack(anchor=tk.W)

        # 个人统计列表
        person_stats_frame = ttk.LabelFrame(parent, text="个人统计", padding=10)
        person_stats_frame.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        
        # 创建滚动区域
        self.person_stats_canvas = tk.Canvas(person_stats_frame, height=200)
        self.person_stats_scrollbar = ttk.Scrollbar(person_stats_frame, orient="vertical", command=self.person_stats_canvas.yview)
        self.person_stats_inner = ttk.Frame(self.person_stats_canvas)
        
        self.person_stats_inner.bind(
            "<Configure>",
            lambda e: self.person_stats_canvas.configure(
                scrollregion=self.person_stats_canvas.bbox("all")
            )
        )
        
        self.person_stats_canvas.create_window((0, 0), window=self.person_stats_inner, anchor="nw")
        self.person_stats_canvas.configure(yscrollcommand=self.person_stats_scrollbar.set)
        
        self.person_stats_canvas.pack(side="left", fill="both", expand=True)
        self.person_stats_scrollbar.pack(side="right", fill="y")
        
        # 用于存储个人统计标签，便于更新
        self.person_stats_labels = []

    def create_list_panel(self, parent):
        """创建列表面板"""
        # 搜索框
        search_frame = ttk.Frame(parent)
        search_frame.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(search_frame, text="搜索:").pack(side=tk.LEFT, padx=(0, 5))
        self.search_entry = ttk.Entry(search_frame, width=40)
        self.search_entry.pack(side=tk.LEFT, padx=(0, 5))
        self.search_entry.bind('<KeyRelease>', self.on_search)
        
        ttk.Button(search_frame, text="搜索", command=self.on_search).pack(side=tk.LEFT, padx=5)
        ttk.Button(search_frame, text="重置", command=self.reset_search).pack(side=tk.LEFT)
        
        # 导出搜索结果按钮（只有在有搜索关键词时可用）
        self.export_search_btn = ttk.Button(search_frame, text="导出搜索结果", command=self.export_search_results, state=tk.DISABLED)
        self.export_search_btn.pack(side=tk.LEFT, padx=5)

        # 创建树形视图
        columns = ("序号", "日期", "人物", "描述", "金额", "类型")
        self.tree = ttk.Treeview(parent, columns=columns, show="headings", selectmode="browse")

        # 设置列（支持点击排序）
        for col in columns:
            self.tree.heading(col, text=col, command=lambda c=col: self.on_sort(c))

        self.tree.column("序号", width=50, anchor="center")
        self.tree.column("日期", width=100, anchor="center")
        self.tree.column("人物", width=100, anchor="center")
        self.tree.column("描述", width=250, anchor="w")
        self.tree.column("金额", width=100, anchor="e")
        self.tree.column("类型", width=80, anchor="center")

        # 添加滚动条
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

        # 绑定双击编辑事件
        self.tree.bind("<Double-1>", self.on_double_click)
        # 绑定右键菜单事件
        self.tree.bind("<Button-3>", self.on_right_click)

    def on_search(self, event=None):
        """搜索账目"""
        self.search_query = self.search_entry.get().strip()
        self.current_page = 1
        self.refresh_list()
        
        # 更新导出按钮状态
        if self.search_query:
            self.export_search_btn.config(state=tk.NORMAL)
        else:
            self.export_search_btn.config(state=tk.DISABLED)

    def reset_search(self):
        """重置搜索"""
        self.search_entry.delete(0, tk.END)
        self.search_query = ""
        self.current_page = 1
        self.refresh_list()
        
        # 禁用导出按钮
        self.export_search_btn.config(state=tk.DISABLED)

    def on_sort(self, column):
        """排序处理"""
        field_map = {
            "序号": "id",
            "日期": "date", 
            "人物": "person",
            "金额": "amount",
            "类型": "type"
        }
        
        field = field_map.get(column, "date")
        
        if self.current_sort["field"] == field:
            self.current_sort["order"] = "asc" if self.current_sort["order"] == "desc" else "desc"
        else:
            self.current_sort["field"] = field
            self.current_sort["order"] = "desc"
        
        self.refresh_list()

    def change_page_size(self):
        """改变每页条数"""
        try:
            new_size = int(self.page_size_var.get())
            if new_size > 0:
                self.page_size = new_size
                self.current_page = 1
                self.refresh_list()
        except ValueError:
            messagebox.showerror("错误", "请输入有效的数字")

    def first_page(self):
        """跳转到首页"""
        if self.current_page > 1:
            self.current_page = 1
            self.refresh_list()

    def prev_page(self):
        """上一页"""
        if self.current_page > 1:
            self.current_page -= 1
            self.refresh_list()

    def next_page(self):
        """下一页"""
        if self.current_page < self.total_pages:
            self.current_page += 1
            self.refresh_list()

    def last_page(self):
        """跳转到末页"""
        if self.current_page < self.total_pages:
            self.current_page = self.total_pages
            self.refresh_list()

    def create_pagination(self, parent):
        """创建分页控件"""
        pagination_frame = ttk.Frame(parent)
        pagination_frame.pack(side=tk.BOTTOM, fill=tk.X, pady=(5, 0))
        
        self.page_size_var = tk.StringVar(value=str(self.page_size))
        ttk.Label(pagination_frame, text="每页:").pack(side=tk.LEFT, padx=(0, 5))
        ttk.Combobox(pagination_frame, textvariable=self.page_size_var, 
                     values=["20", "50", "100", "200", "500"], width=6).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(pagination_frame, text="应用", command=self.change_page_size).pack(side=tk.LEFT, padx=(0, 20))
        
        ttk.Button(pagination_frame, text="首页", command=self.first_page).pack(side=tk.LEFT, padx=2)
        ttk.Button(pagination_frame, text="上一页", command=self.prev_page).pack(side=tk.LEFT, padx=2)
        self.page_label = ttk.Label(pagination_frame, text="第 1 / 1 页")
        self.page_label.pack(side=tk.LEFT, padx=10)
        ttk.Button(pagination_frame, text="下一页", command=self.next_page).pack(side=tk.LEFT, padx=2)
        ttk.Button(pagination_frame, text="末页", command=self.last_page).pack(side=tk.LEFT, padx=2)

    def add_entry(self):
        """添加账目"""
        try:
            date = self.date_entry.get().strip()
            person = self.person_entry.get().strip()
            amount_str = self.amount_entry.get().strip()
            type_value = self.type_var.get()
            description = self.description_text.get("1.0", tk.END).strip()

            if not date or not person or not amount_str:
                messagebox.showerror("错误", "日期、人物和金额不能为空")
                return

            if not validate_date_format(date):
                messagebox.showerror("错误", "日期格式不正确，请使用YYYYMMDD格式")
                return

            try:
                amount = float(amount_str)
                if amount <= 0:
                    raise ValueError()
            except ValueError:
                messagebox.showerror("错误", "金额必须是正数")
                return

            entry = {
                "date": date,
                "person": person,
                "amount": amount,
                "type": type_value,
                "description": description
            }

            self.data_manager.add_entry(entry)
            messagebox.showinfo("成功", "账目添加成功")
            self.clear_input()
            self.refresh_list()

        except Exception as e:
            messagebox.showerror("错误", f"添加失败: {str(e)}")

    def clear_input(self):
        """清空输入"""
        self.date_entry.delete(0, tk.END)
        self.date_entry.insert(0, datetime.now().strftime("%Y%m%d"))
        self.person_entry.delete(0, tk.END)
        self.amount_entry.delete(0, tk.END)
        self.description_text.delete("1.0", tk.END)
        self.type_var.set("借出")

    def refresh_list(self, entries=None):
        """刷新列表"""
        if entries is None:
            # 根据搜索条件获取数据
            if self.search_query:
                entries = self.data_manager.search_entries(self.search_query)
            else:
                entries = self.data_manager.load_entries(
                    sort_by=self.current_sort["field"],
                    order=self.current_sort["order"],
                    limit=self.page_size,
                    offset=(self.current_page - 1) * self.page_size
                )
                
                # 计算总页数
                total_entries = self.data_manager.get_total_entries()
                self.total_pages = max(1, (total_entries + self.page_size - 1) // self.page_size)

        # 清空现有数据
        for item in self.tree.get_children():
            self.tree.delete(item)

        # 添加新数据
        for idx, entry in enumerate(entries, 1):
            self.tree.insert("", tk.END, values=(
                idx + (self.current_page - 1) * self.page_size,
                entry["date"],
                entry["person"],
                entry.get("description", ""),
                f"{entry['amount']:.2f}",
                entry["type"]
            ), tags=(str(entry['id']),))

        # 更新页码显示
        self.page_label.config(text=f"第 {self.current_page} / {self.total_pages} 页")

        # 更新统计信息
        self.update_stats()

    def update_stats(self):
        """更新统计信息"""
        # 根据是否有搜索关键词获取不同的统计数据
        if self.search_query:
            stats = self.data_manager.get_statistics_with_keyword(self.search_query)
            stats_text = f"[搜索: {self.search_query}] "
        else:
            stats = self.data_manager.get_statistics()
            stats_text = ""
        
        stats_text += f"总记录数: {stats['total_entries']:,} | "
        stats_text += f"总借出: ¥{stats['total_lend']:,.2f} | "
        stats_text += f"总收回: ¥{stats['total_receive']:,.2f} | "
        stats_text += f"结余: ¥{stats['balance']:,.2f}"

        self.stats_label.config(text=stats_text)
        
        # 更新个人统计
        self.update_person_stats()

    def update_person_stats(self):
        """更新个人统计列表"""
        # 清空旧的统计标签
        for label in self.person_stats_labels:
            label.destroy()
        self.person_stats_labels.clear()
        
        # 根据是否有搜索关键词获取不同的统计数据
        if self.search_query:
            person_stats = self.data_manager.get_statistics_by_person_with_keyword(self.search_query)
        else:
            person_stats = self.data_manager.get_statistics_by_person()
        
        # 创建新的统计标签
        for person, data in person_stats.items():
            lend = data.get('lend', 0)
            receive = data.get('receive', 0)
            balance = receive - lend
            label_text = f"{person}: 借出 ¥{lend:,.2f} | 收回 ¥{receive:,.2f} | 结余 ¥{balance:,.2f}"
            label = ttk.Label(self.person_stats_inner, text=label_text, anchor=tk.W)
            label.pack(fill=tk.X, pady=2)
            self.person_stats_labels.append(label)

    def filter_by_type(self, type_value):
        """按类型筛选"""
        entries = self.data_manager.query_by_type(type_value)
        self.refresh_list(entries)

    def on_double_click(self, event):
        """双击编辑"""
        self.edit_entry()

    def on_right_click(self, event):
        """右键菜单"""
        # 选中被右键的行
        row_id = self.tree.identify_row(event.y)
        if row_id:
            self.tree.selection_set(row_id)

        selection = self.tree.selection()
        
        # 创建右键菜单
        context_menu = tk.Menu(self.root, tearoff=0)
        can_edit = self.current_user.has_permission('edit_entry') if self.current_user else True
        can_delete = self.current_user.has_permission('delete_entry') if self.current_user else True
        
        if can_edit:
            context_menu.add_command(label="编辑账目", command=self.edit_entry)
        if can_delete:
            context_menu.add_command(label="删除账目", command=self.delete_entry)
        context_menu.add_separator()
        context_menu.add_command(label="刷新列表", command=self.refresh_list)
        
        # 如果有选中项，添加复制功能
        if selection:
            context_menu.add_separator()
            context_menu.add_command(label="复制选中行", command=self.copy_selected)
        
        context_menu.post(event.x_root, event.y_root)

    def copy_selected(self):
        """复制选中行的内容到剪贴板"""
        selection = self.tree.selection()
        if not selection:
            return
        item = self.tree.item(selection[0])
        values = item["values"]
        text = "\t".join(str(v) for v in values)
        self.root.clipboard_clear()
        self.root.clipboard_append(text)

    def edit_entry(self):
        """编辑账目"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要编辑的账目")
            return

        item = self.tree.item(selection[0])
        values = item["values"]

        # 创建编辑对话框
        dialog = tk.Toplevel(self.root)
        dialog.title("编辑账目")
        dialog.geometry("400x320")
        dialog.transient(self.root)
        dialog.grab_set()

        # 定位弹窗到选中行附近
        row_id = selection[0]
        row_bbox = self.tree.bbox(row_id)
        if row_bbox:
            x = self.tree.winfo_rootx() + row_bbox[0] + 20
            y = self.tree.winfo_rooty() + row_bbox[1] - 20
            dialog.geometry(f"+{x}+{y}")

        # 日期
        ttk.Label(dialog, text="日期:").grid(row=0, column=0, sticky=tk.W, padx=10, pady=5)
        date_entry = ttk.Entry(dialog, width=15)
        date_entry.insert(0, values[1])
        date_entry.grid(row=0, column=1, sticky=tk.W, pady=5)

        # 人物
        ttk.Label(dialog, text="人物:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        person_entry = ttk.Entry(dialog, width=20)
        person_entry.insert(0, values[2])
        person_entry.grid(row=1, column=1, sticky=tk.W, pady=5)

        # 金额
        ttk.Label(dialog, text="金额:").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        amount_entry = ttk.Entry(dialog, width=15)
        amount_entry.insert(0, values[4])
        amount_entry.grid(row=2, column=1, sticky=tk.W, pady=5)

        # 类型
        ttk.Label(dialog, text="类型:").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
        type_var = tk.StringVar(value=values[5])
        type_frame = ttk.Frame(dialog)
        type_frame.grid(row=3, column=1, sticky=tk.W, pady=5)
        ttk.Radiobutton(type_frame, text="借出", variable=type_var, value="借出").pack(side=tk.LEFT)
        ttk.Radiobutton(type_frame, text="收回", variable=type_var, value="收回").pack(side=tk.LEFT, padx=(10, 0))

        # 描述
        ttk.Label(dialog, text="描述:").grid(row=4, column=0, sticky=tk.W, padx=10, pady=5)
        desc_text = scrolledtext.ScrolledText(dialog, width=30, height=4)
        desc_text.insert("1.0", values[3])
        desc_text.grid(row=4, column=1, pady=5)

        def save_edit():
            """保存编辑"""
            try:
                # 直接从 tags 获取真实ID
                item = self.tree.item(selection[0])
                entry_id = int(item["tags"][0])

                updated = {
                    "date": date_entry.get().strip(),
                    "person": person_entry.get().strip(),
                    "amount": float(amount_entry.get()),
                    "type": type_var.get(),
                    "description": desc_text.get("1.0", tk.END).strip()
                }
                
                self.data_manager.update_entry(entry_id, updated)
                dialog.destroy()
                self.refresh_list()
                messagebox.showinfo("成功", "账目更新成功")
            except Exception as e:
                messagebox.showerror("错误", str(e))

        button_frame = ttk.Frame(dialog)
        button_frame.grid(row=5, column=0, columnspan=2, pady=10)
        ttk.Button(button_frame, text="保存", command=save_edit).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT)

    def delete_entry(self):
        """删除账目"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要删除的账目")
            return

        if not messagebox.askyesno("确认删除", "确定要删除这条账目吗？"):
            return

        try:
            item = self.tree.item(selection[0])
            entry_id = int(item["tags"][0])

            self.data_manager.delete_entry(entry_id)
            self.refresh_list()
            messagebox.showinfo("成功", "账目删除成功")
        except Exception as e:
            messagebox.showerror("错误", str(e))

    def clear_database(self):
        """清空数据库"""
        if not self.is_super_user:
            messagebox.showerror("错误", "只有管理员才能执行此操作")
            return

        if not messagebox.askyesno("危险操作", "此操作将删除所有账目数据，且无法恢复！\n确定要继续吗？"):
            return

        # 验证密码
        password = show_password(self.root, "请输入管理员密码以确认操作：")
        if not password:
            return

        # 验证密码
        user = self.user_manager.authenticate('root', password)
        if not user:
            messagebox.showerror("错误", "密码不正确")
            return

        try:
            self.data_manager.clear_all_entries()
            self.refresh_list()
            messagebox.showinfo("成功", "数据库已清空")
        except Exception as e:
            messagebox.showerror("错误", str(e))

    def export_excel(self):
        """导出Excel"""
        if not self.current_user.has_permission('export_data'):
            messagebox.showerror("权限不足", "您没有导出数据的权限")
            return
        
        try:
            filepath = filedialog.asksaveasfilename(
                defaultextension=".xlsx",
                filetypes=[("Excel文件", "*.xlsx")]
            )
            if filepath:
                entries = self.data_manager.load_entries()
                self.excel_exporter.export(entries, filepath)
                messagebox.showinfo("成功", f"Excel导出成功:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")

    def export_csv(self):
        """导出CSV"""
        if not self.current_user.has_permission('export_data'):
            messagebox.showerror("权限不足", "您没有导出数据的权限")
            return
        
        try:
            filepath = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv")]
            )
            if filepath:
                entries = self.data_manager.load_entries()
                import csv
                with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.writer(f)
                    writer.writerow(["日期", "人物", "描述", "金额", "类型"])
                    for e in entries:
                        writer.writerow([e["date"], e["person"], e.get("description", ""), e["amount"], e["type"]])
                messagebox.showinfo("成功", f"CSV导出成功:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")

    def export_search_results(self):
        """导出搜索结果为CSV"""
        if not self.current_user.has_permission('export_data'):
            messagebox.showerror("权限不足", "您没有导出数据的权限")
            return
        
        if not self.search_query:
            messagebox.showwarning("警告", "请先进行搜索")
            return
        
        try:
            entries = self.data_manager.search_entries(self.search_query)
            if not entries:
                messagebox.showwarning("警告", "当前搜索没有结果")
                return
            
            filepath = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv")],
                initialfile=f"搜索结果_{self.search_query}.csv"
            )
            if filepath:
                import csv
                with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.writer(f)
                    writer.writerow(["日期", "人物", "描述", "金额", "类型"])
                    for e in entries:
                        writer.writerow([e["date"], e["person"], e.get("description", ""), e["amount"], e["type"]])
                messagebox.showinfo("成功", f"搜索结果导出成功:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")

    def import_csv(self):
        """导入CSV数据"""
        filepath = filedialog.askopenfilename(
            title="选择CSV文件导入",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not filepath:
            return

        try:
            entries = self.data_manager.import_from_csv(filepath)
            if not entries:
                messagebox.showwarning("警告", "未从文件中读取到有效数据")
                return

            # 确认导入
            if not messagebox.askyesno(
                "确认导入",
                f"从文件中读取到 {len(entries)} 条有效数据。\n\n确定要导入吗？\n（数据将追加到现有账目中）"
            ):
                return

            # 逐条添加
            success_count = 0
            for entry in entries:
                try:
                    self.data_manager.add_entry(entry)
                    success_count += 1
                except Exception as e:
                    print(f"导入条目失败: {e}")

            self.refresh_list()
            messagebox.showinfo("完成", f"导入完成！成功导入 {success_count} 条数据")
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")

    def backup_data(self):
        """备份数据"""
        if not self.current_user.has_permission('backup_data'):
            messagebox.showerror("权限不足", "您没有备份数据的权限")
            return
        
        try:
            from utils.common import generate_backup_filename

            default_name = generate_backup_filename("账本备份")
            filepath = filedialog.asksaveasfilename(
                title="选择备份保存位置",
                defaultextension=".zip",
                initialfile=default_name,
                filetypes=[("备份文件", "*.db"), ("所有文件", "*.*")]
            )
            if not filepath:
                return

            # 复制数据库文件作为备份
            import shutil
            shutil.copy2(self.data_manager.db_file, filepath)

            # 同时生成CSV备份
            csv_path = filepath.replace(".db", ".csv")
            entries = self.data_manager.load_entries()
            import csv
            with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["日期", "人物", "描述", "金额", "类型"])
                for e in entries:
                    writer.writerow([e["date"], e["person"], e.get("description", ""), e["amount"], e["type"]])

            messagebox.showinfo("成功", f"数据备份成功!\n\n数据库: {filepath}\nCSV副本: {csv_path}")
        except Exception as e:
            messagebox.showerror("错误", f"备份失败: {str(e)}")

    def manage_preset_names(self):
        """管理预设人名"""
        dialog = tk.Toplevel(self.root)
        dialog.title("管理预设人名")
        dialog.geometry("400x300")
        dialog.transient(self.root)

        names = self.config.get("preset_names", [])

        text = scrolledtext.ScrolledText(dialog, width=40, height=10)
        text.pack(padx=10, pady=10)
        text.insert("1.0", "\n".join(names))

        def save():
            new_names = [n.strip() for n in text.get("1.0", tk.END).split("\n") if n.strip()]
            self.config.set("preset_names", new_names)
            self.text_parser.update_names(new_names)
            dialog.destroy()
            messagebox.showinfo("成功", "预设人名已保存")

        ttk.Button(dialog, text="保存", command=save).pack(pady=5)

    def manage_keywords(self):
        """管理关键词"""
        dialog = tk.Toplevel(self.root)
        dialog.title("管理关键词")
        dialog.geometry("500x400")
        dialog.transient(self.root)

        ttk.Label(dialog, text="借出关键词:").pack(anchor=tk.W, padx=10, pady=(10, 0))
        lend_text = scrolledtext.ScrolledText(dialog, width=50, height=5)
        lend_text.pack(padx=10)
        lend_text.insert("1.0", "\n".join(self.config.get("borrow_keywords", [])))

        ttk.Label(dialog, text="收回关键词:").pack(anchor=tk.W, padx=10, pady=(10, 0))
        receive_text = scrolledtext.ScrolledText(dialog, width=50, height=5)
        receive_text.pack(padx=10)
        receive_text.insert("1.0", "\n".join(self.config.get("return_keywords", [])))

        def save():
            lend_kw = [k.strip() for k in lend_text.get("1.0", tk.END).split("\n") if k.strip()]
            receive_kw = [k.strip() for k in receive_text.get("1.0", tk.END).split("\n") if k.strip()]
            self.config.set("borrow_keywords", lend_kw)
            self.config.set("return_keywords", receive_kw)
            self.text_parser.update_keywords(lend_kw, receive_kw)
            dialog.destroy()
            messagebox.showinfo("成功", "关键词已保存")

        ttk.Button(dialog, text="保存", command=save).pack(pady=10)

    def manage_users(self):
        """管理用户"""
        dialog = tk.Toplevel(self.root)
        dialog.title("管理用户")
        dialog.geometry("600x500")
        dialog.transient(self.root)

        columns = ("用户名", "角色", "权限")
        tree = ttk.Treeview(dialog, columns=columns, show="headings")

        tree.heading("用户名", text="用户名")
        tree.heading("角色", text="角色")
        tree.heading("权限", text="权限")

        tree.column("用户名", width=120)
        tree.column("角色", width=100)
        tree.column("权限", width=350)

        def refresh_users():
            for item in tree.get_children():
                tree.delete(item)
            
            users = self.user_manager.get_all_users()
            for user in users:
                role = "超级管理员" if user.is_super else "普通用户"
                if user.is_super:
                    permissions = "全部权限"
                else:
                    perms = [PERMISSIONS.get(p, p) for p in user.permissions]
                    permissions = ", ".join(perms) if perms else "无"
                tree.insert("", tk.END, values=(user.username, role, permissions))

        refresh_users()
        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        def delete_user():
            selection = tree.selection()
            if selection:
                item = tree.item(selection[0])
                values = item["values"]
                if len(values) > 0:
                    username = str(values[0]).strip()
                    if username == "root":
                        messagebox.showerror("错误", "不能删除管理员账户")
                        return
                    if messagebox.askyesno("确认删除", f"确定删除用户 {username}?"):
                        try:
                            self.user_manager.delete_user(username)
                            tree.delete(selection[0])
                            messagebox.showinfo("成功", "用户已删除")
                        except Exception as e:
                            messagebox.showerror("错误", str(e))
                else:
                    messagebox.showerror("错误", "无法获取用户名")

        def edit_user():
            selection = tree.selection()
            if not selection:
                messagebox.showwarning("警告", "请选择要编辑的用户")
                return
            
            item = tree.item(selection[0])
            values = item["values"]
            if len(values) > 0:
                username = str(values[0]).strip()
            else:
                messagebox.showerror("错误", "无法获取用户名")
                return
                
            user = self.user_manager.get_user(username)
            
            edit_dialog = tk.Toplevel(dialog)
            edit_dialog.title(f"编辑用户: {username}")
            edit_dialog.geometry("600x600")

            # 使用Frame和pack布局
            main_frame = ttk.Frame(edit_dialog)
            main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

            # 新密码
            password_frame = ttk.Frame(main_frame)
            password_frame.pack(fill=tk.X, pady=5)
            ttk.Label(password_frame, text="新密码（留空不修改）:").pack(side=tk.LEFT)
            password_entry = ttk.Entry(password_frame, show="*", width=20)
            password_entry.pack(side=tk.LEFT, padx=10)

            # 是否超级管理员（root不能修改）
            is_super_var = tk.BooleanVar(value=user.is_super)
            if username != "root":
                super_frame = ttk.Frame(main_frame)
                super_frame.pack(fill=tk.X, pady=5)
                ttk.Checkbutton(super_frame, text="设为超级管理员", variable=is_super_var).pack(side=tk.LEFT)

            # 权限列表
            perm_label = ttk.Label(main_frame, text="权限:")
            perm_label.pack(anchor=tk.W, pady=(10, 5))
            
            # 创建滚动区域显示权限
            perm_canvas = tk.Canvas(main_frame, height=200)
            perm_scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=perm_canvas.yview)
            perm_frame = ttk.Frame(perm_canvas)
            
            perm_frame.bind(
                "<Configure>",
                lambda e: perm_canvas.configure(scrollregion=perm_canvas.bbox("all"))
            )
            
            perm_canvas.create_window((0, 0), window=perm_frame, anchor="nw")
            perm_canvas.configure(yscrollcommand=perm_scrollbar.set)
            
            perm_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            perm_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            
            perm_vars = {}
            row, col = 0, 0
            for key, label in PERMISSIONS.items():
                perm_vars[key] = tk.BooleanVar(value=user.has_permission(key))
                if username != "root":
                    ttk.Checkbutton(perm_frame, text=label, variable=perm_vars[key]).grid(row=row, column=col, sticky=tk.W, padx=10, pady=2)
                else:
                    ttk.Label(perm_frame, text=f"{label} ✓").grid(row=row, column=col, sticky=tk.W, padx=10, pady=2)
                col += 1
                if col >= 2:
                    col = 0
                    row += 1

            # 按钮框架
            button_frame = ttk.Frame(main_frame)
            button_frame.pack(fill=tk.X, pady=10)
            
            def do_save():
                try:
                    password = password_entry.get() if password_entry.get() else None
                    is_super = is_super_var.get() if username != "root" else None
                    permissions = [k for k, v in perm_vars.items() if v.get()] if username != "root" else None
                    
                    self.user_manager.update_user(username, password, is_super, permissions)
                    edit_dialog.destroy()
                    refresh_users()
                    messagebox.showinfo("成功", "用户信息已更新")
                except Exception as e:
                    messagebox.showerror("错误", str(e))

            ttk.Button(button_frame, text="保存", command=do_save).pack(side=tk.LEFT, padx=5)
            ttk.Button(button_frame, text="取消", command=edit_dialog.destroy).pack(side=tk.LEFT, padx=5)

        def add_user():
            add_dialog = tk.Toplevel(dialog)
            add_dialog.title("添加用户")
            add_dialog.geometry("400x400")

            ttk.Label(add_dialog, text="用户名:").grid(row=0, column=0, padx=10, pady=10)
            username_entry = ttk.Entry(add_dialog)
            username_entry.grid(row=0, column=1, pady=10)

            ttk.Label(add_dialog, text="密码:").grid(row=1, column=0, padx=10, pady=10)
            password_entry = ttk.Entry(add_dialog, show="*")
            password_entry.grid(row=1, column=1, pady=10)

            is_super_var = tk.BooleanVar(value=False)
            ttk.Checkbutton(add_dialog, text="设为超级管理员", variable=is_super_var).grid(row=2, column=0, columnspan=2, pady=5)

            ttk.Label(add_dialog, text="权限:").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
            perm_frame = ttk.Frame(add_dialog)
            perm_frame.grid(row=4, column=0, columnspan=2, padx=10)
            
            perm_vars = {}
            row, col = 0, 0
            for key, label in PERMISSIONS.items():
                perm_vars[key] = tk.BooleanVar(value=False)
                ttk.Checkbutton(perm_frame, text=label, variable=perm_vars[key]).grid(row=row, column=col, sticky=tk.W, padx=10, pady=2)
                col += 1
                if col >= 2:
                    col = 0
                    row += 1

            def do_add():
                try:
                    username = username_entry.get().strip()
                    password = password_entry.get().strip()
                    
                    if not username or not password:
                        messagebox.showerror("错误", "用户名和密码不能为空")
                        return
                    
                    is_super = is_super_var.get()
                    permissions = [k for k, v in perm_vars.items() if v.get()]
                    
                    self.user_manager.add_user(username, password, is_super, permissions)
                    refresh_users()
                    add_dialog.destroy()
                    messagebox.showinfo("成功", "用户添加成功")
                except Exception as e:
                    messagebox.showerror("错误", str(e))

            ttk.Button(add_dialog, text="添加", command=do_add).grid(row=5, column=0, columnspan=2, pady=10)

        button_frame = ttk.Frame(dialog)
        button_frame.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=(0, 10))
        ttk.Button(button_frame, text="添加用户", command=add_user).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="编辑用户", command=edit_user).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="删除用户", command=delete_user).pack(side=tk.LEFT, padx=5)
