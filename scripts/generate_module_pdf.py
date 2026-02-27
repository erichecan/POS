# 2026-02-26T20:30:00+08:00: Generate core business module feature list PDF
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_PATH = "/Library/Fonts/Arial Unicode.ttf"
pdfmetrics.registerFont(TTFont("CJK", FONT_PATH))
pdfmetrics.registerFont(TTFont("CJK-Bold", FONT_PATH))

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "POS_Core_Module_Features_2026-02-26.pdf")

BRAND_DARK = HexColor("#1a1a1a")
BRAND_YELLOW = HexColor("#F6B100")
HEADER_BG = HexColor("#262626")
ROW_ALT = HexColor("#F8F8F8")
WHITE = HexColor("#FFFFFF")
BORDER_COLOR = HexColor("#CCCCCC")

TITLE_STYLE = ParagraphStyle(
    "Title", fontName="CJK-Bold", fontSize=20, leading=26,
    textColor=BRAND_DARK, spaceAfter=4,
)
SUBTITLE_STYLE = ParagraphStyle(
    "Subtitle", fontName="CJK", fontSize=10, leading=14,
    textColor=HexColor("#666666"), spaceAfter=16,
)
CELL_STYLE = ParagraphStyle(
    "Cell", fontName="CJK", fontSize=7.5, leading=10.5,
    textColor=BRAND_DARK,
)
CELL_BOLD = ParagraphStyle(
    "CellBold", fontName="CJK-Bold", fontSize=7.5, leading=10.5,
    textColor=BRAND_DARK,
)
HEADER_STYLE = ParagraphStyle(
    "Header", fontName="CJK-Bold", fontSize=8, leading=11,
    textColor=WHITE,
)
STATUS_STYLE = ParagraphStyle(
    "Status", fontName="CJK", fontSize=7.5, leading=10.5,
    textColor=HexColor("#16a34a"),
)
FOOTER_STYLE = ParagraphStyle(
    "Footer", fontName="CJK", fontSize=7, leading=9,
    textColor=HexColor("#999999"),
)

MODULES = [
    ("M01", "身份与权限",
     "JWT Cookie 认证、登录/注册、角色权限矩阵(Admin/Cashier/Waiter)、数据范围策略、字段级授权与脱敏、会话安全事件记录"),
    ("M02", "桌台与堂食流程",
     "桌台 CRUD、转台、并台、拆单、按席位分单、反并台；桌台可视化编辑器(拖拽布局、区域划分 Main Hall/Terrace/Bar/Corner、桌型选择 Round/Square/Rectangle、添加新桌子、座位数编辑、空区域引导、触摸/桌面双模式)"),
    ("M03", "订单中心",
     "订单创建/编辑/结算、状态机约束(In Progress->Ready->Completed/Cancelled)、版本冲突检测与人工解决、小票模板管理、发票弹窗与浏览器打印"),
    ("M04", "全渠道订单聚合",
     "可配置渠道接入、签名校验、限流配额、死信队列(回放/丢弃)、Provider/Market/Connection/Mapping Rules 四维管理页面"),
    ("M05", "菜单中心",
     "菜品 CRUD(名称/分类/基价/状态/有效期/渠道/描述)、分类管理(层级树、拖拽排序、颜色标记、emoji 图标、CRUD)、版本发布(草稿->预发布->正式)、时段价(Day Parts: 时间段+星期+价格)、同步状态跟踪；HQ-门店架构(总部统一母版 default、门店继承+局部覆盖、Inherited from HQ 标记、一键创建门店级 Override、门店分类从 HQ 导入)"),
    ("M06", "库存与沽清",
     "库存扣减(按订单行)、库存调整、自动 86(沽清停售)、渠道可用性同步任务队列(PENDING/SYNCED/FAILED)、从菜单引导创建库存"),
    ("M07", "厨房生产/KDS",
     "工位路由(冷菜/热菜/酒水/甜品)、备餐计时与超时告警、催单、交接确认、事件回放、负载均衡；工作站/工单/事件回放三个管理子页面"),
    ("M08", "支付中台",
     "Stripe + Mock 多通道路由与失败切换、支付重试、全额/部分退款、双人复核审批、Webhook 验签入库、对账差异追踪；支付账本/退款审批/对账三个管理子页面"),
    ("M09", "现金管理",
     "开班/交班、现金抽屉流水(存入/取出)、盘点、差异分析(应收 vs 实收)"),
    ("M10", "会员与储值",
     "会员账户(档案/等级/标签)、积分累计与兑换、钱包余额、会员流水账本"),
    ("M11", "优惠营销",
     "促销规则 CRUD(折扣/满减/套餐)、优惠券 CRUD、优惠预览、下单自动应用(互斥/叠加/优先级)、核销计数"),
    ("M12", "员工与劳动力",
     "排班管理、打卡上下班、班次查询、团队成员管理页面"),
    ("M13", "财务结算与对账",
     "结算批次生成、核心财务指标、CSV 导出"),
    ("M14", "组织与连锁",
     "总部/区域/门店三级组织模型、配置继承解析、垂直行业模板(7 种预置: 奶茶店/寿司/广式早茶/西餐/中式快餐/美甲店/火锅店；每种模板预配硬件需求、运营模式、菜单选项模型、桌台服务策略；门店绑定模板+JSON Overrides 覆盖；门店自动配置预览)"),
    ("M15", "经营分析",
     "概览指标仪表盘、菜品销售排行分析、订单 CSV 导出"),
    ("M16", "离线与容灾",
     "离线操作入队、操作列表、重放接口、状态追踪"),
    ("M17", "设备生态",
     "设备注册、心跳上报、在线状态查询、硬件目录(打印/KDS/扫码/客显/PDA)、门店硬件档案管理"),
    ("M18", "合作方对接平台",
     "合作方 API Key(Scope/IP 白名单/限流配额)、Webhook 签名预览、公共订单 API"),
    ("M19", "自助点餐/二维码",
     "桌码会话生成、公开菜单接口、扫码下单"),
    ("M20", "合规与安全",
     "审计日志查询与管理页面、PII 脱敏视图、合规导出请求、高风险审批(策略+请求)、合规策略包、关键动作闸门(退款/导出/配置变更)"),
    ("M21", "国际化(i18n)",
     "中英文实时切换、浏览器语言自动检测(localStorage + navigator)、Header/AdminLayout 均有切换按钮、登录/注册/导航/桌台/菜单/购物车/订单/支付/厨房/管理后台全页面文案国际化"),
    ("M22", "分账与结账增强",
     "AA 制分账(平均分模式: 按人数均分；按菜品分模式: 勾选分配到客人组)、Split Bill 独立面板、转桌弹窗(选择目标桌台一键迁移订单)"),
]


def build_pdf():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    doc = SimpleDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=20 * mm, bottomMargin=18 * mm,
        title="POS Core Module Features",
        author="POS Team",
    )

    elements = []

    elements.append(Paragraph("核心业务模块功能清单", TITLE_STYLE))
    elements.append(Paragraph(
        "Global POS System  |  截至 2026-02-26  |  共 22 个模块  |  全部 v1 完成",
        SUBTITLE_STYLE,
    ))
    elements.append(Spacer(1, 4 * mm))

    col_widths = [28, 72, 38, A4[0] - 36 * mm - 28 - 72 - 38]

    header_row = [
        Paragraph("编号", HEADER_STYLE),
        Paragraph("模块", HEADER_STYLE),
        Paragraph("状态", HEADER_STYLE),
        Paragraph("功能清单", HEADER_STYLE),
    ]

    data = [header_row]
    for code, name, features in MODULES:
        data.append([
            Paragraph(code, CELL_BOLD),
            Paragraph(name, CELL_BOLD),
            Paragraph("v1 完成", STATUS_STYLE),
            Paragraph(features, CELL_STYLE),
        ])

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, BRAND_YELLOW),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))

    table = Table(data, colWidths=col_widths, repeatRows=1, splitInRow=True)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)

    elements.append(Spacer(1, 6 * mm))

    tech_note = (
        "技术架构: React + Vite + Redux + React Query + Tailwind + react-i18next | "
        "Node.js + Express + Mongoose | MongoDB Atlas | GCP Cloud Run | "
        "Stripe + Mock Provider | 49 个数据模型 | 23 个 API 路由"
    )
    elements.append(Paragraph(tech_note, FOOTER_STYLE))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_FILE}")
    return OUTPUT_FILE


if __name__ == "__main__":
    build_pdf()
