$(document).ready(function() {
  $("select[name='months'], input[name='operators']").change(function(){
    var $r = $("input[name='operators']");
    var $d = $("select[name='months']");
    if ($r.length == 1 ) {
      var t = parseInt($r.val(), 10);
      var n = parseInt($d.val(), 10);
      if ((t >= 1)&&(t <= 100)) {
        $(".b-total").html((n*960)*t);
      }
    }
  });
  $("#licen").ajaxForm({
    success: function (response) {
      window.location.replace(response);
    }
  });
  var doCheckLicenses = function () {
    $.getJSON( "/licenses", function(data) {
      var items = [];
      if (data[0]) {
        items.push("<table class='uk-table uk-table-striped uk-table-hover uk-table-condensed'><thead><tr><th>Операторов</th><th>Длительность</th><th>Цена</th><th>Дата начала</th><th>Дата окончания</th><th>Статус</th></tr></thead><tbody>");
        data.forEach(function (e) {
          items.push( "<tr><td>" + e.operators + "</td><td>" + e.months + " мес.</td><td>" + e.amount + " <i class='uk-icon-ruble'></i></td><td>" + e.start + "</td><td>" + e.end + "</td><td>" + e.status + "</td></tr>");
        });
        items.push("</tbody></table>");
        var result = items.join( "" );
        $("#b-licenses").html(result);
      }
    });
  };
  setInterval(doCheckLicenses, 2000);
});