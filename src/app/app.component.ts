import { Component, ViewChild, TemplateRef, Injector } from '@angular/core';
import { Graph, Shape, Path } from "@antv/x6";
import { Stencil } from '@antv/x6-plugin-stencil';      // 侧边栏的 UI 组件
import { Snapline } from "@antv/x6-plugin-snapline";    // 对齐线
import { Keyboard } from '@antv/x6-plugin-keyboard';    // 快捷键
import { History } from '@antv/x6-plugin-history';      // 历史记录 - 撤销重做
import { Clipboard } from '@antv/x6-plugin-clipboard';  // 复制粘贴
import { Selection } from '@antv/x6-plugin-selection';  // 框选
import { register } from "@antv/x6-angular-shape";      // angular 节点


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild('template') template!: TemplateRef<{}>;
  private graph!:Graph;

  constructor(private injector:Injector){

  }

  ngOnInit(){
  }

  ngAfterViewInit(){
    const self = this;
    const dom:any = document.querySelector("#container");

    // 初始化画布
    this.graph = new Graph({
      container: dom,
      autoResize: true,
      background: {
        color: "#F2F7FA",
      },
      grid: { //网格
        visible: true,
        type: 'doubleMesh', //类型：主次网格线
        args: [
          {
            color: '#eee', // 主网格线颜色
            thickness: 1, // 主网格线宽度
          },
          {
            color: '#ddd', // 次网格线颜色
            thickness: 1, // 次网格线宽度
            factor: 5, // 主次网格线间隔
          },
        ],
      },
      panning: true, //拖拽平移
      mousewheel: true, //滚轮缩放
      connecting: { //连接线配置
        //router: 'manhattan', //路径类型
        // connector: { //起点终点类型
        //   name: 'rounded',
        //   args: {
        //     radius: 8,
        //   },
        // },
        connector: 'algo-connector', //自定义起点终点类型
        anchor: 'center', //当连接节点的锚点，默认值为节点的 center 
        connectionPoint: 'anchor', //指定节点的连接点，默认为 boundary(节点边框)，此处改为以 anchor(锚点连接)
        allowBlank: false, //是否允许连接到画布空白位置
        snap: { //自动吸附
          radius: 20, //吸附范围 20px
        },
        createEdge() { //自定义新建的边的样式
          return new Shape.Edge({
            attrs: {
              line: {
                stroke: '#A2B1C3',
                strokeWidth: 2,
                targetMarker: {
                  name: 'block',
                  width: 12,
                  height: 8,
                },
              },
            },
            zIndex: 0,
          })
        },
        validateConnection({ targetMagnet }) { //在移动边的时候判断连接是否有效，如果返回 false ，当鼠标放开的时候，不会连接到当前元素，否则会连接到当前元素。
          return !!targetMagnet
        },
      },
      highlighting: { // 当连接桩可以被链接时，在连接桩外
        magnetAdsorbed: {
          name: 'stroke',
          args: {
            attrs: {
              fill: '#5F95FF',
              stroke: '#5F95FF',
            },
          },
        },
      },
    });

    Graph.registerConnector( // 起点终点路径
      'algo-connector',
      (s, e) => {
        const offset = 4
        const deltaY = Math.abs(e.y - s.y)
        const control = Math.floor((deltaY / 3) * 2)

        const v1 = { x: s.x, y: s.y + offset + control }
        const v2 = { x: e.x, y: e.y - offset - control }

        return Path.normalize(
          `M ${s.x} ${s.y}
           L ${s.x} ${s.y + offset}
           C ${v1.x} ${v1.y} ${v2.x} ${v2.y} ${e.x} ${e.y - offset}
           L ${e.x} ${e.y}
          `,
        )
      },
      true,
    )

    // 使用插件
    this.graph.use(new Snapline())
    .use(new Keyboard())
    .use(new Clipboard())
    .use(new History())
    .use(
      new Selection({
        rubberband: true, // 启用框选功能
        showNodeSelectionBox: true, // 显示节点的选择框
        modifiers: 'ctrl', // 按住ctrl
      }),
    )

    //快捷键与事件
    { 
      const graph = this.graph
      // copy cut paste
      graph.bindKey(['meta+c', 'ctrl+c'], () => {
        const cells = graph.getSelectedCells()
        if (cells.length) {
          graph.copy(cells)
        }
        return false
      })
      graph.bindKey(['meta+x', 'ctrl+x'], () => {
        const cells = graph.getSelectedCells()
        if (cells.length) {
          graph.cut(cells)
        }
        return false
      })
      graph.bindKey(['meta+v', 'ctrl+v'], () => {
        if (!graph.isClipboardEmpty()) {
          const cells = graph.paste({ offset: 32 })
          graph.cleanSelection()
          graph.select(cells)
        }
        return false
      })
      
      // undo redo
      graph.bindKey(['meta+z', 'ctrl+z'], () => {
        if (graph.canUndo()) {
          graph.undo()
        }
        return false
      })
      graph.bindKey(['meta+shift+z', 'ctrl+shift+z'], () => {
        if (graph.canRedo()) {
          graph.redo()
        }
        return false
      })
      
      // delete
      graph.bindKey('delete', () => {
        const cells = graph.getSelectedCells()
        if (cells.length) {
          graph.removeCells(cells)
        }
      })

      // 控制连接桩显示/隐藏
      graph.on('node:mouseenter', () => {
        const ports = dom.querySelectorAll('.x6-port-body') as NodeListOf<SVGElement>
        self.showPorts(ports, true)
      })
      graph.on('node:mouseleave', () => {
        const ports = dom.querySelectorAll('.x6-port-body') as NodeListOf<SVGElement>
        self.showPorts(ports, false)
      })
    }

    this.graph.on('node:change:data', ({ node }) => { // 节点data发生变化是触发, 用来改变running时候的连接线样式
      const edges = this.graph.getIncomingEdges(node)
      const { status } = node.getData().ngArguments;
      edges?.forEach((edge) => {
        if (status === 'running') {
          edge.attr('line/strokeDasharray', 5)
          edge.attr('line/style/animation', 'running-line 30s infinite linear')
        } else {
          edge.attr('line/strokeDasharray', '')
          edge.attr('line/style/animation', '')
        }
      })
    })

    self.stencilInit();
  }

  stencilInit(){
    // 初始化 stencil ui组件
    const stencil = new Stencil({
      title: 'Progress Library',
      target: this.graph,
      stencilGraphWidth: 200, // 每个group的宽度
      stencilGraphHeight: 180, // 每个group的高度
      collapsable: false,  // 全局展开按钮，true - 多一行title显示，控制所有组的一起展开收缩
      groups: [ // 必须有
        {
          title: 'Genes',
          name: 'group1',
        },
        {
          title: 'Genius',
          name: 'group2',
          graphHeight: 250, // 单独设置此组的高度等属性
          layoutOptions: {
            columns: 1,
            columnWidth: 176,
            rowHeight: 70,
          },
        },
      ],
      layoutOptions: { // 布局属性
        columns: 2,
        columnWidth: 80,
        rowHeight: 55,
      },
    })
    document.querySelector('#stencil')!.appendChild(stencil.container)

    // stencil 中添加node节点 初始化图形
    const portsAttrs = {
      circle: {
        r: 4,
        magnet: true,
        stroke: '#5F95FF',
        strokeWidth: 1,
        fill: '#fff',
        style: {visibility: 'hidden'}
      },
    }

    const ports = {
      groups: {
        top: {
          position: 'top',
          attrs: portsAttrs
        },
        right: {
          position: 'right',
          attrs: portsAttrs
        },
        bottom: {
          position: 'bottom',
          attrs: portsAttrs
        },
        left: {
          position: 'left',
          attrs: portsAttrs
        },
      },
      items: [
        { group: 'top' },
        { group: 'right' },
        { group: 'bottom' },
        { group: 'left' },
      ],
    }

    Graph.registerNode( //graph 普通节点
      'custom-rect',
      {
        inherit: 'rect',
        width: 66,
        height: 36,
        attrs: {
          body: {
            strokeWidth: 1,
            stroke: '#5F95FF',
            fill: '#EFF4FF',
          },
          text: {
            fontSize: 12,
            fill: '#262626',
          },
        },
        ports: { ...ports },
      },
      true,
    )

    const r1 = this.graph.createNode({
      shape: 'custom-rect',
      label: '开始',
      attrs: {
        body: {
          rx: 20,
          ry: 26,
        },
      },
    })

    register({ //angualr 节点
      shape: 'custom-angular-template-node',
      width: 180,
      height: 36,
      content: this.template,
      injector: this.injector,
      ports: { ...ports },
    });

    const r2 = this.graph.createNode({
      shape: 'custom-angular-template-node',
      data: {
        ngArguments: { //angualr 节点html input 参数
          label: 'angular',
          image:{
            logo: 'https://gw.alipayobjects.com/mdn/rms_43231b/afts/img/A*evDjT5vjkX0AAAAAAAAAAAAAARQnAQ',
            success:
              'https://gw.alipayobjects.com/mdn/rms_43231b/afts/img/A*6l60T6h8TTQAAAAAAAAAAAAAARQnAQ',
            failed:
              'https://gw.alipayobjects.com/mdn/rms_43231b/afts/img/A*SEISQ6My-HoAAAAAAAAAAAAAARQnAQ',
            running:
              'https://gw.alipayobjects.com/mdn/rms_43231b/afts/img/A*t8fURKfgSOgAAAAAAAAAAAAAARQnAQ',
          },
          status:'default'
        },
      },
    })

    //节点添加到 stencil 侧边栏UI组件对应组中
    stencil.load([r1], 'group1')
    stencil.load([r2], 'group2')
  }

  showPorts(ports: NodeListOf<SVGElement>, show: boolean) {
    ports.forEach((item)=>{
      item.style.visibility = show ? 'visible' : 'hidden';
    })
  }

  updateStatus(){
    let node1 = this.graph.getNodes()[1];
    if(node1){
      node1.setData({ //angualr 节点 更新数据
        ngArguments: {
          status: 'running',
        },
      })
    }
  }
}
