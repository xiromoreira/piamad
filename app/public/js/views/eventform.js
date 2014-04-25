var relatives = [];
var collaborators = [];

$(document).ready(function(){
	$('#txt-date').datepicker({
		changeMonth: true,
		changeYear: true,
		numberOfMonths: 2,
		dateFormat: "dd/mm/yy",
		minDate: 0,
		showAnim: "fadeIn"
	});

	var nameList = [];
	var patients = [];
	$.each(userNames, function(k,v){if(k){nameList.push(k);isMedic(v)?{}:patients.push(k);};});
	$.each(userUsers, function(k,v){if(k){nameList.push(k);isMedic(v)?{}:patients.push(k);};});

	$('#txt-patient').val(nameOfId($('#txt-patient').val())).autocomplete({source: patients});
	$('#add-participant').autocomplete({source: nameList});
	$('#btn-add-participant').css('cursor','pointer').click(function(){
		var txt = $('#add-participant');
		if(txt.val() === '')
			tooltip_error(txt,'Please, write the name or user of the participant');
		else {
			var usId = idOfName(txt.val());
			if(!usId)
				tooltip_error(txt,'User not found, please check speeling');
			else if(($.inArray(usId, relatives) > -1) || ($.inArray(usId, collaborators) > -1)) {
				txt.val('');//already added
				$('#'+usId).fadeOut(200).fadeIn(200);
			} else {
				isMedic(usId) ? collaborators.push(usId):relatives.push(usId);
				$('#table-participants').append('<tr id="'+usId+'"><td>'+nameOfId(usId)+'</td></tr>');
				$('#'+usId).hide().fadeIn(200);
				txt.val('');
				bindTable();
			}
		}
	});

	$('#event-form').ajaxForm({
		beforeSubmit	: function (formData, formObject, formOptions){
			$.each(relatives, function(i,p){formData.push({name:"relatives[]", value:p});});
			$.each(collaborators, function(i,p){formData.push({name:"collaborators[]", value:p});});
			formData.push({name:"patient", value:idOfName($('#txt-patient').val())});
			return validEvent();
		},
		statusCode		: {
			200 : function() {showSucess('Event data updated');},
			201 : function() {window.location.href = '/events';},
		},
		error			: function(xhr, response) {
			showError('Fail: '+xhr.responseText);
		}
	});
	bindTable();
	$('#table-participants>tr').each(function(){
		var id = $(this).prop('id');
		$(this).find('td').html(nameOfId(id));
		participants.push(id);
	});
});

function idOfName(n){
	var id = userNames[n];
	if(!id)id=userUsers[n];
	return id;
}
function nameOfId(id){
	var rtn = '';
	$.each(userNames, function(k,v){
		if(v===id)
			rtn = k;
	});
	if(isMedic(id))
		rtn += ' (Medic)';
	return rtn;
}
function isMedic(id){
	var rtn = $.inArray(id,medics);
	return (rtn !== -1);
}

function bindTable() {
	$('#table-participants>tr').unbind("click").click(function(){
		that = $(this);
		collaborators = $.grep(collaborators, function(value) {return value != that.prop('id');});
		relatives = $.grep(relatives, function(value) {return value != that.prop('id');});
		that.remove();
	});
}
function validEvent(){
	var rtn = true;
	var pat = $('#txt-patient').val();
	
	if(isEmpty(pat)){
		rtn = false;
		tooltip_error('#txt-patient','The patient name is mandatory');		
	} else 
	if(!idOfName(pat)){
		rtn = false;
		tooltip_error('#txt-patient','Unknown patient name.');
	}
	if($('#txt-date').val()===''){
		rtn = false;
		tooltip_error('#txt-date','Date is required');
	}
	if($('#txt-hour').val()===''){
		rtn = false;
		tooltip_error('#txt-hour','Hour is required');
	} else if(!(/^[0-5]?[0-9]\:[0-5][0-9]$/.test($('#txt-hour').val()))) {
		rtn = false;
		tooltip_error('#txt-hour','Specified hour is not valid');
	}		
	return rtn;
}