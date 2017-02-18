/**************************************************************************************
**@Author:Luzhou
**@Date:2014-11-08
**@Email:448287076@qq.com
**@Description:扫雷游戏的JS实现版本
****************************************************************************************/
var MineTemplates = {
	HTML	:	{
		NUMBER	:	'<span class="num-img"  ></span><span class="num-img"  ></span><span class="num-img"  ></span>'
	},
	TPL_MAIN_FRAMEWORK : function(data){
		var template =  _.template(
		'<table class ="mineMainTableame" cellspacing="0" cellpadding="0">' + 
			'<tr class="game-menu"><td colspan="3"><%= menu %></td></tr>' + 
			'<tr class="game-infobar"><td ><div  class="mine-counter">' + this.HTML.NUMBER + '</div></td>' +
				'<td><button class="button-game"></button></td>' +
				'<td ><div  class="game-timer">' + this.HTML.NUMBER + '</div></td>'+
			'</tr>'+
			'<tr><td colspan="3" ><table class="mineArea" cellspacing="0" cellpadding="0"><%= area %></table></td></tr>'+
		'</table>');
		return template(data);
	},
	TPL_MENU_BTN	:	function(data){
		var template =  _.template('<span class="menu-btn "><%= name%>'+
								'<table class="game-menu-list " cellspacing="0" cellpadding="0"><%= listHTML %></table>'+
							'</span>');
		return template(data);
	},
	TPL_MENU_LIST	:	function(data){
		var template = _.template(
			'<tr class="menu-option"><td class="menu-option-state"><input  checked="true" type="checkbox" disabled="true" /></td><td ><%= name %></td></tr>');
		return template(data);
	}
};

/*主要逻辑对象*/
var MineGame = function(){
	_xc = [-1,0,1,1,1,0,-1,-1];
	_yc = [-1,-1,-1,0,1,1,1,0];
	/*雷区块状态*/
	MineState = {
		STATE_NORMAL	:	0,
		STATE_FLAG		:	1,
		STATE_DICEY		:	2,
		STATE_BLAST		:	3,
		STATE_ERROR		:	4,
		STATE_MINE		:	5,
		STATE_DICEY_DOWN:	6,
		STATE_NUM8		:	7,
		STATE_NUM7		:	8,
		STATE_NUM6		:	9,
		STATE_NUM5		:	10,
		STATE_NUM4		:	11,
		STATE_NUM3		:	12,
		STATE_NUM2		:	13,
		STATE_NUM1		:	14,
		STATE_EMPTY		:	15
	};
	/*周围雷的数量与状态的映射 
	 *数组下标=>状态
	 */
	MineCountStateMap = [
		MineState.STATE_EMPTY,
		MineState.STATE_NUM1,
		MineState.STATE_NUM2,
		MineState.STATE_NUM3,
		MineState.STATE_NUM4,
		MineState.STATE_NUM5,
		MineState.STATE_NUM6,
		MineState.STATE_NUM7,
		MineState.STATE_NUM8
	];
	/*雷区属性*/
	MineAttr = {
		ATTRIB_EMPTY	:	0,
		ATTRIB_MINE		:	1
	};
	/*游戏状态*/
	GameState = {
		GS_RUN		:	0,
		GS_WAIT		:	1,
		GS_DEAD		:	2,
		GS_VICTORY	:	3
	};
	/*难度等级*/
	GameLevel = {
		LEVEL_PRIMARY	:	0,
		LEVEL_SECONDRY	:	1,
		LEVEL_ADVANCE	:	2,
		LEVEL_CUSTOM	:	3
	};
	/*遍历状态*/
	TravelState = {
		TRAVELED	:	0,
		NOT_TRAVELED:	1
	};
	/*雷区块对象*/
	MineDef = {
		state	:	MineState.STATE_NORMAL,		//状态，参考MineState
		attr	:	MineAttr.ATTRIB_EMPTY,		//属性，参考MineAttr
		around	:	-1,							//周围块雷数量
		tstate	: 	TravelState.NOT_TRAVELED	//遍历状态
	};
	/* 默认配置 
	 * x=>列数 y=>行数 n=>雷数
	 */
	DefaultConfig = {
		'primary'	:	{
			x:9,y:9,n:10
		},
		'secondry'	:	{
			x:16,y:16,n:40
		},
		'advance'	:	{
			x:16,y:30,n:99
		}
	};
	
	var m_config = DefaultConfig['primary'];	//当前配置
	var m_grids = null;							//雷区域二维数组
	var m_state = null;							//游戏状态，参见GameState
	var m_mines = null;							//剩余雷数量
	var m_tick = null;							//游戏开始时间(秒）
	var m_timer = null;							//内置的计时器
	var m_lock = false;							//锁
	var m_level = GameLevel.LEVEL_PRIMARY;		//难度等级，参见GameLevel
	
	//private methods
	isValidIndex = function(x,y){
		return x>=0&&x<m_config.x&&
			y>=0&&y<m_config.y;
	};
	isMine = function(x,y){
		return m_grids[x][y].attr == MineAttr.ATTRIB_MINE;
	};
	//对周围8个位置的遍历函数
	travelAround = function(hitCallback,x,y){
		var hit = 0;
		for(var i = 0 ; i < _xc.length; ++i){
			tx = x + _xc[i];
			ty = y + _yc[i];
			if( isValidIndex(tx,ty) && hitCallback(tx,ty) )
				++hit;
		}
		return hit;
	};
	//获取周围的雷数量
	aroundMines = function(x,y){
		if( m_grids[x][y].around != -1 )
			return m_grids[x][y].around;
		var mines = travelAround(function(tx,ty){
			return isMine(tx,ty);
		},x,y);
		m_grids[x][y].around = mines;
		return mines;
	};
	//当前块是否可以打标
	canFlag = function(x,y){
		return m_grids[x][y].state < MineState.STATE_BLAST;
	};
	canExtended = function(x,y){
		return m_grids[x][y].state >= MineState.STATE_NUM8 &&
			m_grids[x][y].state <= MineState.STATE_NUM1;
	};
	isExtendable = function(x,y){
		return m_grids[x][y].state == MineState.STATE_EMPTY &&
			TravelState.NOT_TRAVELED == m_grids[x][y].tstate;
	};
	isFlag = function(x,y){
		return m_grids[x][y].state == MineState.STATE_FLAG 
	};
	normalClick = function(x,y){
		if(m_grids[x][y].state == MineState.STATE_NORMAL || m_grids[x][y].state == MineState.STATE_EMPTY){
			var mines = aroundMines(x,y);
			m_grids[x][y].state = MineCountStateMap[mines];
		}
	};
	normalSense = function(x,y){
		if(m_grids[x][y].state == MineState.STATE_NORMAL){
			m_grids[x][y].state = MineState.STATE_EMPTY;
		}
	};
	senseAround = function(x,y){
		normalSense(x,y);
		travelAround(function(tx,ty){
			normalSense(tx,ty);
		},x,y);
	};
	//弹回原始状态
	normalize = function(){
		for(var i = 0; i < m_grids.length; ++i){
			for(var j = 0; j < m_grids[i].length; ++j){
				if( m_grids[i][j].state == MineState.STATE_EMPTY &&
					 m_grids[i][j].around == -1){
					 m_grids[i][j].state = MineState.STATE_NORMAL;
				}
			}
		}
	};
	victory = function(){
		var c = 0;
		for(var i = 0; i < m_config.x; ++i){
			for(var j = 0; j<m_config.y;++j){
				if( m_grids[i][j].state < 7 ){
					++c;
				}
			}
		}
		if(c == m_config.n){
			stateChange(GameState.GS_VICTORY);
			clearInterval(m_timer);
		}
	};
	gameOver = function(){
		clearInterval(m_timer);
		m_state = GameState.GS_DEAD;
		for(var i = 0; i < m_config.x; ++i){
			for(var j = 0; j<m_config.y;++j){
				if(MineState.STATE_FLAG == m_grids[i][j].state){
					if(!isMine(i,j))
						m_grids[i][j].state = MineState.STATE_ERROR;
				}
			}
		}
		console.info(m_grids);
	};
	
	//布雷函数
	layMines = function(){
		delete m_grids;
		m_grids = new Array();
		for(var i = 0; i < m_config.x; ++i){
			m_grids[i] = new Array();
			for(var j = 0 ; j < m_config.y; ++j){
				m_grids[i][j] = _.clone(MineDef);
			}
		}
		
		for(var i = 0 ; i < m_config.n; ){
			x = Math.ceil(Math.random()*(m_config.x-1));
			y = Math.ceil(Math.random()*(m_config.y-1));
			if(m_grids[x][y].attr != MineAttr.ATTRIB_MINE){
				m_grids[x][y].attr = MineAttr.ATTRIB_MINE;
				++i;
			}
		}
	};
	
	stateInit = function(){
		m_state = GameState.GS_RUN;
	};
	
	stateChangable = function(){
		return !(GameState.GS_DEAD == m_state || GameState.GS_VICTORY == m_state);
	};
	
	stateChange = function(newState){
		if(stateChangable()){
			m_state = newState;
		}
	};
	

	//Interface
	
	this.GetLevel = function(){
		return m_level;
	};
	
	this.ChangeLevel = function(levelIndex){
		configKey = _.keys(DefaultConfig)[levelIndex];
		m_config = DefaultConfig[configKey];
		m_level = levelIndex;
	};
	
	this.Lock = function(){
		m_lock = true;
	};
	
	this.UnLock = function(){
		m_lock = false;
	};
	
	this.GetGameState = function(){
		return m_state;
	};
	
	this.GetX = function(){
		return m_config.x;
	};
	
	this.GetY = function(){
		return m_config.y;
	};
	
	this.Grids = function(){
		return m_grids;
	};
	
	
	this.Commandable = function(){
		if(stateChangable() && !m_lock){
			this.GameStart();
			return true;
		}
		return false;
	};
	
	this.GetMinesCount = function(){
		return m_mines;
	};
	
	this.GetTick = function(){
		return m_tick;
	};
	
	
	this.GameInit = function( ){
		layMines();
		stateInit();
		m_mines = m_config.n;
		m_tick = 0;
		clearTimeout(m_timer);
		m_timer = null;
	};
	
	this.GameStart = function(){
		if(m_timer == null){
			m_timer = setInterval(function(){
				if(!m_lock)
					++m_tick;
			},1000);
		}
	};
	
	
	this.ClickDown = function(x,y){
		stateChange(GameState.GS_WAIT);
		normalSense(x,y);
	};
	
	this.ExtendDown = function(x,y){
		stateChange(GameState.GS_WAIT);
		senseAround(x,y);
	};
	
	this.FlagMine = function(x,y){
		if(canFlag(x,y)){
			var bf = isFlag(x,y);
			m_grids[x][y].state = (m_grids[x][y].state + 1) % 3;
			if(isFlag(x,y))
				--m_mines;
			else if(bf)
				++m_mines;
		}
	};
	
	this.ProbMine = function(x,y){
		if(isFlag(x,y)){
			return;
		}
		if(  isMine(x,y) ){	//GameOver
			m_grids[x][y].state = MineState.STATE_ERROR;
			gameOver();
			return;
		}else{
			normalClick(x,y);
			if(  isExtendable(x,y)  ){
				var that = this;
				m_grids[x][y].tstate = 0;
				var probCallback = function(tx,ty){
					that.ProbMine(tx,ty);
				};
				travelAround(probCallback,x,y);
			}
		}
		stateChange(GameState.GS_RUN);
		victory();
	}
	
	this.Revise = function(x,y){
		normalize();
	};
	
	this.ExtendAround = function(x,y){
		if(!canExtended(x,y)){
			stateChange(GameState.GS_RUN);
			return;
		}
		var flags = travelAround(function(tx,ty){
			return m_grids[tx][ty].state == MineState.STATE_FLAG;
		},x,y);
		var mc = aroundMines(x,y);
		if( flags ==  mc){
			var that = this;
			extendCallback = function(tx,ty){
				if(m_grids[tx][ty].state != MineState.STATE_FLAG){
					that.ProbMine(tx,ty);
				}
			};
			travelAround(extendCallback,x,y);
		}
		stateChange(GameState.GS_RUN);
	};
};

/*菜单语言包*/
var Lang = {
	L_BTN_GAME	:	0,
	L_BTN_HELP	:	1,
	L_LIST_START:	2,
	L_LIST_LEVEL_PRIMARY	:	3,
	L_LIST_LEVEL_SECONDRY	:	4,
	L_LIST_LEVEL_ADVANCE	:	5,
	L_LIST_RECORD	:	6,
	L_LIST_HELP	:	7,
	L_LIST_ABOUT:	8,
	LangCN : ['游戏','帮助','开局','初级','中级','高级','扫雷英雄榜','帮助','关于...'],
	LangEN : ['Game','Help','Start','Primary','Sencondry','Advance','Records','Help','About...'],
	m_now :	function(){	//返回当前语言包
		return this.LangCN;
	},
	T	:	function(ID){
		_l = this.m_now();
		return _l[ID];
	}
};

/*视图层逻辑，用于绘制和事件绑定*/
var MineLayout =  function( id ){
	$container = $('#' + id);
	EVENT_LEFT_CLICK = 1;
	EVENT_RIGHT_CLICK = 3;
	EVENT_LR_CLICK = 4;
	_eventCmd = {
		'mousedown'	:	{
			1	:	'ClickDown',
			3	:	'FlagMine',
			4	:	'ExtendDown'
		},
		'mouseup'	:	{
			1	:	'ProbMine',
			3	:	'Revise',
			4	:	'ExtendAround'
		}
	};

	//游戏菜单
	var MineMenu = function( $menu ){
		
		CLASS_BTN_DOWN = 'menu-btn-down';
		CLASS_LIST = 'game-menu-list';
		CLASS_CHECKED = 'menu-state-checked';
		//菜单配置
		MenuList = [
			{
				L	:	Lang.L_BTN_GAME,
				list:	[
					{L:Lang.L_LIST_START,C:'initialize'},
					{L:Lang.L_LIST_LEVEL_PRIMARY,C:'changeLevel#0'},
					{L:Lang.L_LIST_LEVEL_SECONDRY,C:'changeLevel#1'},
					{L:Lang.L_LIST_LEVEL_ADVANCE,C:'changeLevel#2'},
					{L:Lang.L_LIST_RECORD,C:'showRecords'}
				]
			},
			{
				L	:	Lang.L_BTN_HELP,
				list:	[
					{L:Lang.L_LIST_HELP,C:'initialize'},
					{L:Lang.L_LIST_ABOUT,C:'showAbout'}
				]
			}
		];
		
		m_index = -1;
		$buttons = $menu.find('.menu-btn');
		
		hideLists = function(){
			if( -1 != m_index ){
				var button = $($buttons[m_index]);
				button.removeClass(CLASS_BTN_DOWN).find('.'+CLASS_LIST).hide();
				m_index = -1;
			}
		};
		
		excute = function(cmd){
			funcArgs = cmd.split('#');
			callStr = funcArgs[0] + '('+funcArgs.splice(1) + ')';
			eval( callStr );
		};
		
		showLists = function(index){
			var li = m_index;
			hideLists();
			if(-1 != li && li == index){
				return;
			}
			m_index = index;
			var button = $($buttons[m_index]);
			button.addClass(CLASS_BTN_DOWN).find('.'+CLASS_LIST).show();
			
			if(button.index() == 0){
				$menu.find('.'+CLASS_CHECKED).removeClass(CLASS_CHECKED);
				checkIndex = m_Instance.GetLevel() + 1;
				button.find('.menu-option-state:eq('+checkIndex+')').addClass(CLASS_CHECKED);
			}
		};
		
		$menu.on('click','.menu-btn',function(){
			var index = $(this).data('index');
			showLists(index);
		});
		$menu.on('click','.menu-option',function(){
			i = $(this).parents('.menu-btn').data('index');
			j = $(this).index();
			excute(MenuList[i]['list'][j].C);
		});
		
		
		this.Clear = function(){
			hideLists();
		};
		
		this.CreateMenu = function(){
			$menuContent = $menu.find('td');
			for(var i = 0; i<MenuList.length;++i){
				html_list = '';
				for(var j = 0; j<MenuList[i]['list'].length;++j){
					data = MenuList[i]['list'][j];
					data = _.extend(data,{name:Lang.T(data.L)});
					html_list += MineTemplates.TPL_MENU_LIST( data );
				}
				data =  MenuList[i];
				data = _.extend(data,{name:Lang.T(data.L), listHTML: html_list });
				$menuContent.append(
						$(MineTemplates.TPL_MENU_BTN( data )).data('index',i)
					);
			}
			$buttons = $menu.find('.menu-btn');
		};
	};
	
	//properties
	/*************************** JQuery Objects *************************/
	$buttonGame = null;		//笑脸按钮
	$timer = null;			//计时器
	$counter = null;		//雷数量计数器
	$area = null;			//雷区
	$menu = null;			//菜单

	/********************* End of JQuery Objects *************************/
	
	var m_menu = null;		//菜单对象，参见MineLayout.MineMenu
	var m_Instance = null;	//核心对象，参见MineGame
	
	//private methods
	setNumber = function(dom, num){
		end = num>=0 ? 0:1;
		num = num > 999 ? 999 :num ;
		num = num < -99 ? -99 : num;
		num = num>=0 ? num:-num;
		pos = 2;
		while(pos>=end){
			ypos = (1 + num%10)*23;
			$(dom[pos--]).css('background-position-y',ypos);
			num = Math.floor(num/10);
		}
		if(1 == end){
			$(dom[0]).css('background-position-y',12*23);
		}
	};
	
	changeLevel = function(level){
		m_Instance.ChangeLevel(level);
		initialize();
	};
	
	timerUpdator = function(){
		setNumber($timer,0);
		var timer = setInterval(function(){
			setNumber($timer,m_Instance.GetTick());
		},1000);
	};
	
	drawArea = function(){
		grids = m_Instance.Grids();
		$area.empty();
		for(var i = 0; i < grids.length; ++i){
			$row = $('<tr  />').data('x',i);
			for(var j = 0; j < grids[i].length; ++j){
				$row.append(
					$('<td />').data('y',j)
				);
			}
			$area.append($row);
		}
	};
	
	updateArea = function(){
		grids = m_Instance.Grids();
		$trs = $area.find('tr');
		x = m_Instance.GetX(); y = m_Instance.GetY();
		for(var i = 0; i < x; ++i){
			for(var j = 0; j < y; ++j){
				ypos =  (16 -  grids[i][j].state) * 16;
				$($trs[ i]).find('td:eq('+j+')').css('background-position-y', ypos );
			}
		}
	};

	showAbout = function(){

	};
	
	command = function(cmd,which,x,y){
		if( m_Instance.Commandable() && 
				_eventCmd[cmd][which] != undefined ){
			m_menu.Clear();
			func = _eventCmd[cmd][which];
			m_Instance[func](x,y);
			if( cmd == 'mouseup' ){
				m_Instance.Revise();
			}
			update();
		}
	};
	
	createHTML = function(){
		data = { area:'',menu:'' };
		$container.empty().append(
				MineTemplates.TPL_MAIN_FRAMEWORK(data)
			);
	};
	
	assignJqueryObjects = function(){
		$buttonGame = $container.find('.button-game');
		$timer = $container.find('.game-infobar .game-timer .num-img');
		$counter = $container.find('.game-infobar .mine-counter .num-img');
		$area = $container.find('.mineArea');
		$menu = $container.find('.game-menu');
	};
	
	//Create HTML && Assign && Bind Events
	createHTML();
	assignJqueryObjects();

	//events
	$container.ready(function(){  
        $(document).bind("contextmenu",function(e){  
            return false;  
        });  
    }); 
	$buttonGame.mousedown(function(){
		$(this).css('background-position-y',0);
	}).mouseup(function(){
		$(this).css('background-position-y',24);
		initialize();
	});
	$area.on('mousedown','td',function(e){
		last = e.which;
		$td = $(this);
		delayTimeout = setTimeout(function(){
			if(e.which != last){
				e.which = EVENT_LR_CLICK;
			}
			x = $td.parent().data('x');
			y = $td.data('y');
			command('mousedown',e.which,x,y);
			clearTimeout(delayTimeout);
		},100);
	}).on('mouseup','td',function(e){
		last = e.which;
		$td = $(this);
		delayTimeout2 = setTimeout(function(){
			if(e.which != last){
				e.which = EVENT_LR_CLICK;
			}
			x = $td.parent().data('x');
			y = $td.data('y');
			clearTimeout(delayTimeout2);
			command('mouseup',e.which,x,y);
		},100);
	});
	

	//Core Draw Functions
	
	update = function(){
		setNumber($counter,m_Instance.GetMinesCount());
		updateArea();
		ypos = (m_Instance.GetGameState() + 1)*24;
		$buttonGame.css('background-position-y',ypos);
	};

	
	initialize = function(){
		m_Instance.GameInit();
		drawArea();
		timerUpdator();
		update();
	};
	
	//initialize
	m_Instance = new MineGame();
	initialize();
	m_menu = new MineMenu($menu);
	m_menu.CreateMenu();
};




$(function(){
	ml = new MineLayout('game_container');
});
