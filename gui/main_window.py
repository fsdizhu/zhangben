import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
from collections import defaultdict
import os
from data_manager import DataManager
from text_parser import TextParser
from excel_exporter import ExcelExporter
from config import ConfigManager
from user_auth import UserAuth
from utils.common import get_app_data_dir, validate_date_format


class AccountBookGUI:
    """主窗口GUI"""

    def __init__(self, root, is_super_user=False, current_username=None):
        self.root = root
        self.root.title("账本管理工具")
        self.root.geometry("1400x800")

        self.is_super_user = is_super_user
        self.current_username = current_username

        self.data_manager = DataManager()
        self.text_parser = TextParser()
        self.excel_exporter = ExcelExporter()
        self.config = ConfigManager()
        self.user_auth = UserAuth()

        self.setup_ui()

    def setup_ui(self):
        """设置主界面"""
        # 创建菜单栏
        self.create_menu()

        # 创建主框架
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # 左侧面板 - 输入区域
        left_panel = ttk.LabelFrame(main_frame, text="账目录入", padding=10)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, 5))

        self.create_input_panel(left_panel)

        # 右侧面板 - 账目列表
        right_panel = ttk.LabelFrame(main_frame, text="账目列表", padding=10)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.create_list_panel(right_panel)

    def create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导出Excel", command=self.export_excel)
        file_menu.add_command(label="导出CSV", command=self.export_csv)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)

        # 配置菜单
        if self.is_super_user:
            config_menu = tk.Menu(menubar, tearoff=0)
            menubar.add_cascade(label="配置", menu=config_menu)
            config_menu.add_command(label="管理预设人名", command=self.manage_preset_names)
            config_menu.add_command(label="管理关键词", command=self.manage_keywords)
            config_menu.add_command(label="管理用户", command=self.manage_users)

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
        ttk.Button(button_frame, text="添加账目", command=self.add_entry).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="清空", command=self.clear_input).pack(side=tk.LEFT)

        # 统计信息
        stats_frame = ttk.LabelFrame(parent, text="统计信息", padding=10)
        stats_frame.pack(fill=tk.X, pady=(10, 0))
        self.stats_label = ttk.Label(stats_frame, text="加载中...")
        self.stats_label.pack()

    def create_list_panel(self, parent):
        """创建列表面板"""
        # 创建树形视图
        columns = ("序号", "日期", "人物", "描述", "金额", "类型")
        self.tree = ttk.Treeview(parent, columns=columns, show="headings", selectmode="browse")

        # 设置列
        self.tree.heading("序号", text="序号")
        self.tree.heading("日期", text="日期")
        self.tree.heading("人物", text="人物")
        self.tree.heading("描述", text="描述")
        self.tree.heading("金额", text="金额")
        self.tree.heading("类型", text="类型")

        self.tree.column("序号", width=50, anchor="center")
        self.tree.column("日期", width=100, anchor="center")
        self.tree.column("人物", width=100, anchor="center")
        self.tree.column("描述", width=200, anchor="w")
        self.tree.column("金额", width=100, anchor="e")
        self.tree.column("类型", width=80, anchor="center")

        # 添加滚动条
        vsb = ttk.Scrollbar(parent, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)

        # 绑定双击事件
        self.tree.bind("<Double-1>", self.on_double_click)

        # 按钮面板
        button_frame = ttk.Frame(parent)
        button_frame.pack(fill=tk.X, pady=5)
        ttk.Button(button_frame, text="编辑", command=self.edit_entry).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="删除", command=self.delete_entry).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="刷新", command=self.refresh_list).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="筛选借出", command=lambda: self.filter_by_type("借出")).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="筛选收回", command=lambda: self.filter_by_type("收回")).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="显示全部", command=self.refresh_list).pack(side=tk.LEFT, padx=5)

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
            entries = self.data_manager.get_all_entries()

        # 清空现有数据
        for item in self.tree.get_children():
            self.tree.delete(item)

        # 添加新数据
        for idx, entry in enumerate(entries, 1):
            self.tree.insert("", tk.END, values=(
                idx,
                entry["date"],
                entry["person"],
                entry.get("description", ""),
                f"{entry['amount']:.2f}",
                entry["type"]
            ))

        # 更新统计信息
        self.update_stats(entries)

    def update_stats(self, entries=None):
        """更新统计信息"""
        if entries is None:
            entries = self.data_manager.get_all_entries()

        lend_total = sum(e["amount"] for e in entries if e["type"] == "借出")
        receive_total = sum(e["amount"] for e in entries if e["type"] == "收回")
        balance = lend_total - receive_total

        stats_text = f"总记录数: {len(entries)} | "
        stats_text += f"总借出: ¥{lend_total:,.2f} | "
        stats_text += f"总收回: ¥{receive_total:,.2f} | "
        stats_text += f"结余: ¥{balance:,.2f}"

        self.stats_label.config(text=stats_text)

    def filter_by_type(self, type_value):
        """按类型筛选"""
        entries = self.data_manager.get_all_entries()
        filtered = [e for e in entries if e["type"] == type_value]
        self.refresh_list(filtered)

    def on_double_click(self, event):
        """双击编辑"""
        self.edit_entry()

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
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()

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
        ttk.Radiobutton(dialog, text="借出", variable=type_var, value="借出").grid(row=3, column=1, sticky=tk.W)
        ttk.Radiobutton(dialog, text="收回", variable=type_var, value="收回").grid(row=3, column=1, sticky=tk.W, padx=80)

        # 描述
        ttk.Label(dialog, text="描述:").grid(row=4, column=0, sticky=tk.W, padx=10, pady=5)
        desc_text = scrolledtext.ScrolledText(dialog, width=30, height=4)
        desc_text.insert("1.0", values[3])
        desc_text.grid(row=4, column=1, pady=5)

        def save_edit():
            """保存编辑"""
            try:
                entry_id = self.data_manager.get_all_entries()[int(values[0]) - 1]["id"]
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

        if not messagebox.askyesno("确认", "确定要删除这条账目吗?"):
            return

        try:
            item = self.tree.item(selection[0])
            values = item["values"]
            entry_id = self.data_manager.get_all_entries()[int(values[0]) - 1]["id"]
            self.data_manager.delete_entry(entry_id)
            self.refresh_list()
            messagebox.showinfo("成功", "账目删除成功")
        except Exception as e:
            messagebox.showerror("错误", str(e))

    def export_excel(self):
        """导出Excel"""
        try:
            filepath = filedialog.asksaveasfilename(
                defaultextension=".xlsx",
                filetypes=[("Excel文件", "*.xlsx")]
            )
            if filepath:
                entries = self.data_manager.get_all_entries()
                self.excel_exporter.export(entries, filepath)
                messagebox.showinfo("成功", f"Excel导出成功:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")

    def export_csv(self):
        """导出CSV"""
        try:
            filepath = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV文件", "*.csv")]
            )
            if filepath:
                entries = self.data_manager.get_all_entries()
                import csv
                with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
                    writer = csv.writer(f)
                    writer.writerow(["日期", "人物", "描述", "金额", "类型"])
                    for e in entries:
                        writer.writerow([e["date"], e["person"], e.get("description", ""), e["amount"], e["type"]])
                messagebox.showinfo("成功", f"CSV导出成功:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")

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
        dialog.geometry("500x400")
        dialog.transient(self.root)

        columns = ("用户名", "角色", "操作")
        tree = ttk.Treeview(dialog, columns=columns, show="headings")

        for col in columns:
            tree.heading(col, text=col)

        users = self.user_auth.get_all_users()
        for user in users:
            tree.insert("", tk.END, values=(user["username"], user.get("role", "user"), "删除"))

        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        def delete_user():
            selection = tree.selection()
            if selection:
                username = tree.item(selection[0])["values"][0]
                if username == "root":
                    messagebox.showerror("错误", "不能删除管理员账户")
                    return
                if messagebox.askyesno("确认", f"确定删除用户 {username}?"):
                    self.user_auth.delete_user(username)
                    tree.delete(selection[0])

        ttk.Button(dialog, text="删除选中用户", command=delete_user).pack(pady=5)

        def add_user():
            add_dialog = tk.Toplevel(dialog)
            add_dialog.title("添加用户")
            add_dialog.geometry("300x200")

            ttk.Label(add_dialog, text="用户名:").grid(row=0, column=0, padx=10, pady=10)
            username_entry = ttk.Entry(add_dialog)
            username_entry.grid(row=0, column=1, pady=10)

            ttk.Label(add_dialog, text="密码:").grid(row=1, column=0, padx=10, pady=10)
            password_entry = ttk.Entry(add_dialog, show="*")
            password_entry.grid(row=1, column=1, pady=10)

            def do_add():
                try:
                    self.user_auth.register_user(username_entry.get(), password_entry.get())
                    tree.insert("", tk.END, values=(username_entry.get(), "user", "删除"))
                    add_dialog.destroy()
                    messagebox.showinfo("成功", "用户添加成功")
                except Exception as e:
                    messagebox.showerror("错误", str(e))

            ttk.Button(add_dialog, text="添加", command=do_add).grid(row=2, column=0, columnspan=2, pady=10)

        ttk.Button(dialog, text="添加用户", command=add_user).pack(pady=5)
