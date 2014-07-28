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
});